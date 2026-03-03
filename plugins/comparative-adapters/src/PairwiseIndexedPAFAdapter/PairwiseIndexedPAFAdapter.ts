import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { parsePAFLine } from '../util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

interface PAFOptions extends BaseOptions {
  config?: AnyConfigurationModel
}

export default class PAFAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected pif: TabixIndexedFile
  private summaryRefsPromise?: Promise<Set<string>>

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
      csiFilehandle: type === 'CSI' ? openLocation(loc, pm) : undefined,
      tbiFilehandle: type !== 'CSI' ? openLocation(loc, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
  }
  async getHeader(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    return updateStatus('Downloading header', statusCallback, () =>
      this.pif.getHeader(),
    )
  }

  getAssemblyNames(): string[] {
    const assemblyNames = this.getConf('assemblyNames') as string[]
    return assemblyNames.length === 0
      ? [
          this.getConf('queryAssembly') as string,
          this.getConf('targetAssembly') as string,
        ]
      : assemblyNames
  }

  private getSummaryRefNames() {
    if (!this.summaryRefsPromise) {
      this.summaryRefsPromise = this.pif
        .getReferenceSequenceNames()
        .then(
          names =>
            new Set(
              names.filter(n => n.startsWith('sq') || n.startsWith('st')),
            ),
        )
    }
    return this.summaryRefsPromise
  }

  public async hasDataForRefName() {
    return true
  }

  async getRefNames(opts: BaseOptions & { regions?: Region[] } = {}) {
    const r1 = opts.regions?.[0]?.assemblyName
    if (!r1) {
      // Called without assembly context (e.g. from CoreGetRefNames RPC via
      // assembly manager). Return empty — hasDataForRefName returns true
      // unconditionally so the ref name map isn't needed for this adapter.
      return []
    }

    const idx = this.getAssemblyNames().indexOf(r1)
    const names = await this.pif.getReferenceSequenceNames(opts)
    if (idx === 0) {
      return names
        .filter(n => n.startsWith('q') && !n.startsWith('sq'))
        .map(n => n.slice(1))
    } else if (idx === 1) {
      return names
        .filter(n => n.startsWith('t') && !n.startsWith('st'))
        .map(n => n.slice(1))
    } else {
      return []
    }
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    const { statusCallback = () => {}, bpPerPx } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      // assemblyNames = [queryAssembly, targetAssembly]
      const assemblyNames = this.getAssemblyNames()
      const index = assemblyNames.indexOf(assemblyName)

      // flip=true when viewing from query assembly perspective
      // flip=false when viewing from target assembly perspective
      const flip = index === 0

      // PIF format indexes lines by perspective:
      // - 'q' prefix lines are indexed by query coordinates
      // - 't' prefix lines are indexed by target coordinates
      const letter = flip ? 'q' : 't'

      // Use summary prefix (sq/st) when zoomed out for faster queries
      const useSummary = bpPerPx !== undefined && bpPerPx > 500
      let prefix = useSummary ? `s${letter}` : letter

      // Fallback: if summary refs don't exist (old PIF file), use full prefix
      if (useSummary) {
        const summaryRefs = await this.getSummaryRefNames()
        if (!summaryRefs.has(prefix + query.refName)) {
          prefix = letter
        }
      }

      // The "other" assembly is the mate
      const mateAssemblyName = assemblyNames[flip ? 1 : 0]

      await updateStatus('Downloading features', statusCallback, () =>
        this.pif.getLines(prefix + query.refName, query.start, query.end, {
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
            const prefixLen = prefix.length
            const refName = r.qname.slice(prefixLen)
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
                identity: numMatches / blockLen,
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
          stopToken: opts.stopToken,
        }),
      )

      observer.complete()
    })
  }
}
