import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  getAssemblyNamesFromConf,
  hasCoarseTierPrefix,
  makeIndexedSyntenyFeature,
  parsePifLine,
  resolveCoarseTier,
} from '../util.ts'

import type { PairwiseIndexedPAFAdapterConfig } from './configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

// PIF indexes each line by perspective: a 'q' prefix means indexed by query
// coordinates (drawn when viewing the query), 't' means indexed by target
// coordinates. Uppercase T/Q are the optional coarse no-CIGAR tier (see
// resolveCoarseTier). pickPifPrefix chooses the perspective letter for the fine
// tier and upper-cases it when the coarse tier should be served.
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
  return resolveCoarseTier({ bpPerPx, threshold, hasCoarseTier, lodMode })
    ? fineLetter.toUpperCase()
    : fineLetter
}

export default class PairwiseIndexedPAFAdapter extends BaseFeatureDataAdapter<PairwiseIndexedPAFAdapterConfig> {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected pif: TabixIndexedFile
  private refSeqNamesP?: Promise<string[]>

  public constructor(
    config: PairwiseIndexedPAFAdapterConfig,
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

  // The tabix contig list, read once. Every seqid is a refName prefixed with its
  // tier letter (fine q/t, coarse Q/T); both getRefNames and the coarse-tier
  // probe derive from this one fetch.
  private async refSeqNames(opts?: BaseOptions) {
    this.refSeqNamesP ??= this.pif
      .getReferenceSequenceNames(opts)
      .catch((e: unknown) => {
        this.refSeqNamesP = undefined
        throw e
      })
    return this.refSeqNamesP
  }

  async getRefNames(opts: BaseOptions = {}) {
    const r1 = opts.assemblyName
    if (!r1) {
      throw new Error('no assembly name provided')
    }

    const idx = this.getAssemblyNames().indexOf(r1)
    const names = await this.refSeqNames(opts)
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

  private async hasCoarseTier(opts?: BaseOptions) {
    return hasCoarseTierPrefix(await this.refSeqNames(opts))
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    const { statusCallback = () => {} } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      // assemblyNames = [queryAssembly, targetAssembly]
      const assemblyNames = this.getAssemblyNames()
      const index = assemblyNames.indexOf(assemblyName)
      if (index === -1) {
        console.warn(`${assemblyName} not found in this adapter`)
        observer.complete()
        return
      }

      // flip=true when viewing from query assembly perspective
      // flip=false when viewing from target assembly perspective
      const flip = index === 0

      const letter = pickPifPrefix({
        flip,
        bpPerPx: opts.bpPerPx,
        threshold: this.getConf('coarseBpPerPxThreshold'),
        hasCoarseTier: await this.hasCoarseTier(opts),
        lodMode: opts.lodMode,
      })

      // The "other" assembly is the mate
      const mateAssemblyName = assemblyNames[flip ? 1 : 0]!

      const label = 'Downloading features'
      await updateStatus(label, statusCallback, () =>
        this.pif.getLines(letter + query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            const parsed = parsePifLine(line)
            observer.next(
              makeIndexedSyntenyFeature({
                line: parsed,
                fileOffset,
                assemblyName,
                refName: parsed.indexedName.slice(1), // strip q/t prefix
                mate: {
                  start: parsed.mateStart,
                  end: parsed.mateEnd,
                  refName: parsed.mateName,
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
