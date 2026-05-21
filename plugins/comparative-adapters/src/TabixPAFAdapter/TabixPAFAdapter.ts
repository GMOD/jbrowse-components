import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { pafIdentity, parsePAFLine, parsePanSN } from '../util.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseOptions,
  BaseOptionsWithRegions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

export type { MultiPairFeature } from '../MultiPairFeature.ts'

/**
 * Reads a standard PAF (sorted by target, bgzipped, `tabix -0 -s6 -b8 -e9`)
 * where each query line is a haplotype-path block projected onto a reference
 * path — the `odgi untangle -R <ref>` output described in
 * agent-docs/GRAPH_PLAN.md. The PAF target is the reference (the indexed
 * coordinate space); the PAF query is a haplotype path whose PanSN
 * `sample#hap` prefix becomes the synteny row genome.
 */
export default class TabixPAFAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected paf: TabixIndexedFile

  // bare refName (or genome-qualified key) → tabix-indexed sequence name
  private refNameMapP?: Promise<Map<string, string>>

  // query genome names, from the `#genomes=` header or the config override
  private genomesP?: Promise<string[]>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pafGzLoc = this.getConf('pafGzLocation') as FileLocation
    const type = this.getConf(['index', 'indexType'])
    const loc = this.getConf(['index', 'location'])
    const pm = this.pluginManager

    this.paf = new TabixIndexedFile({
      filehandle: openLocation(pafGzLoc, pm),
      csiFilehandle: type === 'CSI' ? openLocation(loc, pm) : undefined,
      tbiFilehandle: type !== 'CSI' ? openLocation(loc, pm) : undefined,
      chunkCacheSize: 50 * 2 ** 20,
    })
  }

  private getGenomes() {
    this.genomesP ??= (async () => {
      const configured = this.getConf('assemblyNames') as string[]
      if (configured.length > 0) {
        return configured
      }
      const header = await this.paf.getHeader()
      const match = /^#genomes=(.*)$/m.exec(header)
      return match
        ? match[1]!
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []
    })()
    return this.genomesP
  }

  async getSources() {
    return (await this.getGenomes()).map(name => ({ name }))
  }

  // PAF target names are PanSN (`GRCh38#0#chr20`) but the display queries with
  // a bare refName (`chr20`). Build a lookup once: full name, bare refName, and
  // a genome-qualified key disambiguate when two references share a refName.
  private getRefNameMap() {
    this.refNameMapP ??= this.paf.getReferenceSequenceNames().then(names => {
      const map = new Map<string, string>()
      for (const name of names) {
        const { genome, refName } = parsePanSN(name)
        map.set(name, name)
        if (!map.has(refName)) {
          map.set(refName, name)
        }
        const key = `${genome.split('#')[0]!}\u0000${refName}`
        if (!map.has(key)) {
          map.set(key, name)
        }
      }
      return map
    })
    return this.refNameMapP
  }

  private async resolveRefName(assemblyName: string, refName: string) {
    const map = await this.getRefNameMap()
    const qualified = map.get(`${assemblyName.split('#')[0]!}\u0000${refName}`)
    if (qualified) {
      return qualified
    }
    return map.get(refName) ?? refName
  }

  public async hasDataForRefName() {
    return true
  }

  getAssemblyNames(): string[] {
    return this.getConf('assemblyNames') as string[]
  }

  async getRefNames(_opts: BaseOptionsWithRegions = {}) {
    const names = await this.paf.getReferenceSequenceNames()
    return [...new Set(names.map(n => parsePanSN(n).refName))]
  }

  async getMultiPairFeatures(
    query: Region,
    _opts: { bpPerPx?: number; stopToken?: StopToken } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const tabixRefName = await this.resolveRefName(
      query.assemblyName,
      query.refName,
    )
    const jaccardFilter = this.getConf('jaccardFilter') as number

    await this.paf.getLines(tabixRefName, query.start, query.end, {
      lineCallback: (line, fileOffset) => {
        const r = parsePAFLine(line)
        const { extra } = r
        if (
          jaccardFilter > 0 &&
          extra.jc !== undefined &&
          +extra.jc < jaccardFilter
        ) {
          return
        }
        const { genome } = parsePanSN(r.qname)
        const feature: MultiPairFeature = {
          queryGenome: genome,
          origRefName: query.refName,
          start: r.tstart,
          end: r.tend,
          mateStart: r.qstart,
          mateEnd: r.qend,
          mateRefName: r.qname,
          strand: r.strand,
          syriType: undefined,
          identity: pafIdentity(extra),
          featureId: `${fileOffset}`,
          segmentId: undefined,
          cigar: typeof extra.cg === 'string' ? extra.cg : undefined,
          cs: typeof extra.cs === 'string' ? extra.cs : undefined,
        }
        let row = genomeRows.get(genome)
        if (!row) {
          row = []
          genomeRows.set(genome, row)
        }
        row.push(feature)
      },
    })

    return { genomeRows }
  }

  // Reference-perspective pairwise features, for use in LinearSyntenyDisplay /
  // DotplotDisplay. The PAF is indexed on the target only.
  getFeatures(query: Region, opts: BaseOptions = {}) {
    const { statusCallback = () => {} } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query
      const tabixRefName = await this.resolveRefName(
        assemblyName,
        query.refName,
      )
      const jaccardFilter = this.getConf('jaccardFilter') as number

      await updateStatus('Downloading features', statusCallback, () =>
        this.paf.getLines(tabixRefName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            const r = parsePAFLine(line)
            const { extra } = r
            if (
              jaccardFilter > 0 &&
              extra.jc !== undefined &&
              +extra.jc < jaccardFilter
            ) {
              return
            }
            const matches = +extra.numMatches!
            const blockLen = +extra.blockLen!
            observer.next(
              new SyntenyFeature({
                uniqueId: fileOffset + assemblyName,
                assemblyName,
                start: r.tstart,
                end: r.tend,
                type: 'match',
                refName: query.refName,
                strand: r.strand,
                CIGAR: typeof extra.cg === 'string' ? extra.cg : undefined,
                syntenyId: fileOffset,
                identity: pafIdentity(extra),
                numMatches: Number.isFinite(matches) ? matches : 0,
                blockLen: Number.isFinite(blockLen) ? blockLen : 1,
                mate: {
                  start: r.qstart,
                  end: r.qend,
                  refName: r.qname,
                  assemblyName: parsePanSN(r.qname).genome,
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
