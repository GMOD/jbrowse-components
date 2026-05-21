import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { pafIdentity, parsePAFLine } from '../util.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  BaseOptions,
  BaseOptionsWithRegions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
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
  private headerDataPromise?: Promise<{
    splitThreshold?: number
    mergeGap?: number
    pairCount?: number
    pairs?: Map<number, [string, string]>
  }>

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
    const { statusCallback = () => {} } = opts ?? {}
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
    this.summaryRefsPromise ??= this.pif
      .getReferenceSequenceNames()
      .then(
        names =>
          new Set(
            names.filter(
              n =>
                n.startsWith('sq') ||
                n.startsWith('st') ||
                n.startsWith('xq') ||
                n.startsWith('xt'),
            ),
          ),
      )
    return this.summaryRefsPromise
  }

  private getHeaderData() {
    this.headerDataPromise ??= this.pif.getHeader().then(header => {
      const splitMatch = /splitThreshold=(\d+)/.exec(header)
      const mergeMatch = /mergeGap=(\d+)/.exec(header)
      const pairsMatch = /pairs=(\d+)/.exec(header)
      const pairs = new Map<number, [string, string]>()

      if (pairsMatch) {
        const pairRegex = /pair(\d+)=([^,\n]+),([^,\n]+)/g
        let m: RegExpExecArray | null
        while ((m = pairRegex.exec(header)) !== null) {
          pairs.set(+m[1]!, [m[2]!, m[3]!])
        }
      }

      return {
        splitThreshold: splitMatch ? +splitMatch[1]! : undefined,
        mergeGap: mergeMatch ? +mergeMatch[1]! : undefined,
        pairCount: pairsMatch ? +pairsMatch[1]! : undefined,
        pairs: pairs.size > 0 ? pairs : undefined,
      }
    })
    return this.headerDataPromise
  }

  async getSources() {
    const { pairs } = await this.getHeaderData()
    const names = new Set<string>()
    if (pairs) {
      for (const [q, t] of pairs.values()) {
        names.add(q)
        names.add(t)
      }
    }
    return [...names].map(name => ({ name }))
  }

  public async hasDataForRefName() {
    return true
  }

  async getRefNames(opts: BaseOptionsWithRegions = {}) {
    const r1 = opts.regions?.[0]?.assemblyName
    if (!r1) {
      return []
    }

    const idx = this.getAssemblyNames().indexOf(r1)
    const names = await this.pif.getReferenceSequenceNames(opts)
    const letter = idx === 0 ? 'q' : idx === 1 ? 't' : undefined
    if (!letter) {
      return []
    }

    // Match both single-pair (q, t) and multi-pair (q0, q1, t0, t1) prefixes
    // Exclude summary (sq, st) and structural (xq, xt) prefixes
    const fullPrefixRegex = new RegExp(String.raw`^${letter}\d*`)
    const excludePrefixRegex = new RegExp(`^[sx]${letter}`)

    const refNames = new Set<string>()
    for (const n of names) {
      if (excludePrefixRegex.test(n)) {
        continue
      }
      const match = fullPrefixRegex.exec(n)
      if (match) {
        refNames.add(n.slice(match[0].length))
      }
    }
    return [...refNames]
  }

  getFeatures(query: Region, opts: PAFOptions = {}) {
    const { statusCallback = () => {}, bpPerPx } = opts
    return ObservableCreate<Feature>(async observer => {
      const { assemblyName } = query

      const assemblyNames = this.getAssemblyNames()
      const index = assemblyNames.indexOf(assemblyName)
      const flip = index === 0
      const letter = flip ? 'q' : 't'

      const headerData = await this.getHeaderData()
      const { splitThreshold, mergeGap, pairCount, pairs } = headerData

      // Determine pair index for multi-pair PIF files
      let pairIdx = ''
      if (pairCount !== undefined && pairs) {
        for (const [idx, [a, b]] of pairs) {
          if (assemblyNames.includes(a) && assemblyNames.includes(b)) {
            pairIdx = String(idx)
            break
          }
        }
      }

      // 3-tier LOD selection:
      // - structural tier (xt/xq): bpPerPx > mergeGap (or splitThreshold * 10)
      // - summary tier (st/sq): bpPerPx > splitThreshold
      // - full tier (t/q): else
      const structuralThreshold =
        mergeGap ?? (splitThreshold ? splitThreshold * 10 : undefined)
      const useStructural =
        structuralThreshold !== undefined &&
        bpPerPx !== undefined &&
        bpPerPx > structuralThreshold
      const useSummary =
        !useStructural &&
        splitThreshold !== undefined &&
        bpPerPx !== undefined &&
        bpPerPx > splitThreshold

      let prefix: string
      if (useStructural) {
        prefix = `x${letter}${pairIdx}`
      } else if (useSummary) {
        prefix = `s${letter}${pairIdx}`
      } else {
        prefix = `${letter}${pairIdx}`
      }

      // Fallback: if the chosen prefix refs don't exist, try lower tiers
      if (useStructural || useSummary) {
        const summaryRefs = await this.getSummaryRefNames()
        if (!summaryRefs.has(prefix + query.refName)) {
          if (useStructural) {
            prefix = `s${letter}${pairIdx}`
            if (!summaryRefs.has(prefix + query.refName)) {
              prefix = `${letter}${pairIdx}`
            }
          } else {
            prefix = `${letter}${pairIdx}`
          }
        }
      }

      const mateAssemblyName = assemblyNames[flip ? 1 : 0]
      const isStructural = prefix.startsWith('x')

      await updateStatus('Downloading features', statusCallback, () =>
        this.pif.getLines(prefix + query.refName, query.start, query.end, {
          lineCallback: (line, fileOffset) => {
            if (isStructural) {
              // Structural tier lines have different format:
              // xt<tname>\t<tlen>\t<tstart>\t<tend>\t<strand>\t<qname>\t<qlen>\t<qstart>\t<qend>\t<syriType>\t<meanIdentity>
              const parts = line.split('\t')
              const prefixLen = prefix.length
              const refName = parts[0]!.slice(prefixLen)
              const start = +parts[2]!
              const end = +parts[3]!
              const strand = parts[4] === '-' ? -1 : 1
              const mateName = parts[5]!
              const mateStart = +parts[7]!
              const mateEnd = +parts[8]!
              const syriType = parts[9] || 'SYN'
              const meanIdentity = +(parts[10] || 0)

              observer.next(
                new SyntenyFeature({
                  uniqueId: fileOffset + assemblyName,
                  assemblyName,
                  start,
                  end,
                  type: 'match',
                  refName,
                  strand,
                  syriType,
                  syntenyId: fileOffset,
                  identity: meanIdentity,
                  numMatches: 0,
                  blockLen: 0,
                  mate: {
                    start: mateStart,
                    end: mateEnd,
                    refName: mateName,
                    assemblyName: mateAssemblyName,
                  },
                }),
              )
            } else {
              const r = parsePAFLine(line)
              const { strand } = r
              const extra = r.extra
              const { numMatches = 0, blockLen = 1, cg, sy, ...rest } = extra

              const start = r.qstart
              const end = r.qend
              const prefixLen = prefix.length
              const refName = r.qname.slice(prefixLen)
              const mateName = r.tname
              const mateStart = r.tstart
              const mateEnd = r.tend
              const CIGAR = cg

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
                  ...(sy ? { syriType: sy } : {}),
                  syntenyId: fileOffset,
                  identity: pafIdentity(extra),
                  numMatches: +numMatches,
                  blockLen: +blockLen,
                  mate: {
                    start: mateStart,
                    end: mateEnd,
                    refName: mateName,
                    assemblyName: mateAssemblyName,
                  },
                }),
              )
            }
          },
        }),
      )

      observer.complete()
    })
  }
}
