import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { getAssemblyNamesFromConf, pafIdentity, parsePAFLine } from '../util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

// PIF format indexes lines by perspective:
// - 'q' prefix: indexed by query coordinates, drawn when viewing the query
// - 't' prefix: indexed by target coordinates, drawn when viewing the target
// Uppercase T/Q are the optional coarse no-CIGAR tier emitted by `make-pif
// --coarse`. Coarse rows carry the same start/end coords as the matching
// fine row(s) (the CLI may also split a single fine row into multiple
// coarse rows at large CIGAR I/D gaps so each coarse row's bbox stays
// tight). In 'auto' mode the coarse tier is used when bpPerPx >= threshold
// and the tier actually exists. A manual 'coarse' override still falls
// back to fine when no coarse tier is present — the alternative would be
// returning no data.
export function pickPifPrefix({
  flip,
  bpPerPx,
  threshold,
  hasCoarseTier,
  lodMode = 'auto',
}: {
  flip: boolean
  bpPerPx: number | undefined
  threshold: number
  hasCoarseTier: boolean
  lodMode?: BaseOptions['lodMode']
}) {
  const fineLetter = flip ? 'q' : 't'
  const auto = bpPerPx !== undefined && bpPerPx >= threshold && hasCoarseTier
  const useCoarse =
    hasCoarseTier && (lodMode === 'coarse' || (lodMode === 'auto' && auto))
  return useCoarse ? fineLetter.toUpperCase() : fineLetter
}

export default class PairwiseIndexedPAFAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected pif: TabixIndexedFile
  private coarseTierAvailable?: Promise<boolean>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pifGzLoc = this.getConf('pifGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.pif = new TabixIndexedFile({
      filehandle: openLocation(pifGzLoc, pm),
      ...openTabixIndexFilehandle(loc, type, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })
  }
  async getHeader(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return updateStatus('Downloading header', statusCallback, () =>
      this.pif.getHeader(),
    )
  }

  getAssemblyNames(): string[] {
    return getAssemblyNamesFromConf(this)
  }

  public async hasDataForRefName() {
    return true
  }

  async getRefNames(opts: BaseOptions = {}) {
    const r1 = opts.assemblyName
    if (!r1) {
      throw new Error('no assembly name provided')
    }

    const idx = this.getAssemblyNames().indexOf(r1)
    const names = await this.pif.getReferenceSequenceNames(opts)
    // Only consider the fine tier here so we don't double-report chroms when
    // the coarse T/Q tier is also present.
    if (idx === 0) {
      return names.filter(n => n.startsWith('q')).map(n => n.slice(1))
    } else if (idx === 1) {
      return names.filter(n => n.startsWith('t')).map(n => n.slice(1))
    } else {
      return []
    }
  }

  // Cache whether the file contains an uppercase T/Q coarse tier. Checked
  // once via the tabix refname list.
  private async hasCoarseTier(opts?: BaseOptions): Promise<boolean> {
    if (!this.coarseTierAvailable) {
      this.coarseTierAvailable = this.pif
        .getReferenceSequenceNames(opts)
        .then(names => names.some(n => n.startsWith('T') || n.startsWith('Q')))
    }
    return this.coarseTierAvailable
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    const { statusCallback = () => {} } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      // assemblyNames = [queryAssembly, targetAssembly]
      const assemblyNames = this.getAssemblyNames()
      const index = assemblyNames.indexOf(assemblyName)

      // flip=true when viewing from query assembly perspective
      // flip=false when viewing from target assembly perspective
      const flip = index === 0

      const letter = pickPifPrefix({
        flip,
        bpPerPx: opts.bpPerPx,
        threshold: this.getConf('coarseBpPerPxThreshold') as number,
        hasCoarseTier: await this.hasCoarseTier(opts),
        lodMode: opts.lodMode,
      })

      // Surface the resolved tier so the user can see auto-fallback / coarse
      // degradation in the status bar without needing to inspect network calls.
      const isCoarse = letter === letter.toUpperCase()
      statusCallback(`Loading ${isCoarse ? 'coarse' : 'fine'} tier`)

      // The "other" assembly is the mate
      const mateAssemblyName = assemblyNames[flip ? 1 : 0]

      await updateStatus('Downloading features', statusCallback, () =>
        this.pif.getLines(letter + query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            const r = parsePAFLine(line)
            const { extra, strand } = r
            const { numMatches = 0, blockLen = 1, cg, ...rest } = extra

            // PIF format pre-orients each line from its perspective:
            // - When querying 'q' lines: columns 2-3 have query coords (the "main" feature)
            // - When querying 't' lines: columns 2-3 have target coords (the "main" feature)
            // The first column has the indexed refName (with q/t prefix to strip)
            // The 6th column (tname) has the mate's refName (no prefix)
            //
            // This means r.qstart/qend always represent the "main" feature coords
            // for whichever perspective we're viewing from, and r.tstart/tend
            // represent the mate coords
            const start = r.qstart
            const end = r.qend
            const refName = r.qname.slice(1) // Strip 'q'/'t' prefix
            const mateName = r.tname
            const mateStart = r.tstart
            const mateEnd = r.tend

            // PIF format already has pre-computed CIGARs for each perspective
            // (q-lines have D↔I swapped relative to t-lines)
            const CIGAR = extra.cg

            observer.next(
              new SyntenyFeature({
                uniqueId: fileOffset + assemblyName,
                assemblyName,
                start,
                end,
                type: 'match',
                refName,
                strand,
                ...rest,
                CIGAR,
                syntenyId: fileOffset,
                identity: pafIdentity(extra),
                numMatches,
                blockLen,
                mate: {
                  start: mateStart,
                  end: mateEnd,
                  refName: mateName,
                  assemblyName: mateAssemblyName,
                },
              }),
            )
          },
        }),
      )

      observer.complete()
    })
  }
}
