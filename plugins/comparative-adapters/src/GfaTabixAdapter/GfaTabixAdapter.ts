import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { annotateFeaturesWithBubbleCs } from './bubbleOverlay.ts'
import {
  type CoarseRow,
  coarseRowsToGfa,
  parseCoarseLine,
} from './coarseSubgraphReader.ts'
import {
  hasFileLocation,
  openTabixIfConfigured,
  parseGfaPathName,
  parseSizesField,
  readHeaderField,
} from './gfaTabixUtils.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type { TabixIndexedFile } from '@gmod/tabix'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { FileLocation, Region } from '@jbrowse/core/util/types'
import type { GenericFilehandle } from 'generic-filehandle2'

interface SetupResult {
  genomes: string[]
  chromSizes: Map<string, { refName: string; length: number }[]>
  posRefNames: Set<string>
  syntenyRefNames: Set<string>
  bubblesRefNames?: Set<string>
  bubblesGenomeNames?: string[]
  graphCoarseRefNames?: Set<string>
  graphCoarseAssemblyMap?: Map<string, string[]>
}

function parseOrdinalRanges(line: string, out: Set<number>) {
  let t = 0
  for (let n = 0; n < 3; n++) {
    t = line.indexOf('\t', t) + 1
  }
  const t5 = line.indexOf('\t', t)
  const col4 = line.slice(t, t5 !== -1 ? t5 : undefined)
  for (const token of col4.split(',')) {
    const dash = token.indexOf('-')
    if (dash > 0) {
      const lo = +token.slice(0, dash)
      const hi = +token.slice(dash + 1)
      for (let i = lo; i <= hi; i++) {
        out.add(i)
      }
    } else {
      out.add(+token)
    }
  }
}

export default class GfaTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  private readonly posFile: TabixIndexedFile
  private readonly syntenyFile: TabixIndexedFile
  private readonly syntenyCoarseFile?: TabixIndexedFile
  private readonly graphCoarseFile?: TabixIndexedFile
  private readonly bubblesFile?: TabixIndexedFile
  private readonly edgesFile?: TabixIndexedFile
  private readonly seqlensHandle?: GenericFilehandle
  private readonly assemblyNameMap: Record<string, string>
  private readonly reverseAssemblyNameMap: Map<string, string>
  private readonly graphCoarseAssemblyMapHandle?: GenericFilehandle
  private setupP?: Promise<SetupResult>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    this.assemblyNameMap = this.getConf('assemblyNameMap') as Record<
      string,
      string
    >
    this.reverseAssemblyNameMap = new Map(
      Object.entries(this.assemblyNameMap).map(([file, display]) => [
        display,
        file,
      ]),
    )

    this.posFile = openTabixIfConfigured(
      this.getConf('posLocation') as FileLocation,
      this.getConf(['posIndex', 'location']) as FileLocation,
      pm,
    )!

    this.syntenyFile = openTabixIfConfigured(
      this.getConf('syntenyLocation') as FileLocation,
      this.getConf(['syntenyIndex', 'location']) as FileLocation,
      pm,
    )!

    this.syntenyCoarseFile = openTabixIfConfigured(
      this.getConf('syntenyCoarseLocation') as FileLocation | undefined,
      this.getConf(['syntenyCoarseIndex', 'location']) as
        | FileLocation
        | undefined,
      pm,
    )

    this.graphCoarseFile = openTabixIfConfigured(
      this.getConf('graphCoarseLocation') as FileLocation | undefined,
      this.getConf(['graphCoarseIndex', 'location']) as
        | FileLocation
        | undefined,
      pm,
    )

    this.bubblesFile = openTabixIfConfigured(
      this.getConf('bubblesLocation') as FileLocation | undefined,
      this.getConf(['bubblesIndex', 'location']) as FileLocation | undefined,
      pm,
    )

    this.edgesFile = openTabixIfConfigured(
      this.getConf('edgesLocation') as FileLocation | undefined,
      this.getConf(['edgesIndex', 'location']) as FileLocation | undefined,
      pm,
    )

    const seqlensLoc = this.getConf('seqlensLocation') as
      | FileLocation
      | undefined
    if (hasFileLocation(seqlensLoc)) {
      this.seqlensHandle = openLocation(seqlensLoc, pm)
    }

    const assemblyMapLoc = this.getConf('graphCoarseAssemblyMap') as
      | FileLocation
      | undefined
    if (hasFileLocation(assemblyMapLoc)) {
      this.graphCoarseAssemblyMapHandle = openLocation(assemblyMapLoc, pm)
    }
  }

  private async setup() {
    this.setupP ??= this.setupPre()
    return this.setupP
  }

  private async setupPre(): Promise<SetupResult> {
    const header = await this.posFile.getHeader()

    const genomesField = readHeaderField(header, 'genomes')
    const genomes = genomesField?.split(',') ?? []

    const sizesField = readHeaderField(header, 'sizes')
    const sizesEntries = sizesField ? parseSizesField(sizesField) : []
    const chromSizes = new Map<string, { refName: string; length: number }[]>()
    for (const { genome, refName, length } of sizesEntries) {
      let arr = chromSizes.get(genome)
      if (!arr) {
        arr = []
        chromSizes.set(genome, arr)
      }
      arr.push({ refName, length })
    }

    const posRefNames = new Set(await this.posFile.getReferenceSequenceNames())
    const syntenyRefNames = new Set(
      await this.syntenyFile.getReferenceSequenceNames(),
    )

    let bubblesRefNames: Set<string> | undefined
    let bubblesGenomeNames: string[] | undefined
    if (this.bubblesFile) {
      const bHeader = await this.bubblesFile.getHeader()
      bubblesRefNames = new Set(
        await this.bubblesFile.getReferenceSequenceNames(),
      )
      bubblesGenomeNames = readHeaderField(bHeader, 'genomes')?.split(',')
    }

    let graphCoarseRefNames: Set<string> | undefined
    if (this.graphCoarseFile) {
      graphCoarseRefNames = new Set(
        await this.graphCoarseFile.getReferenceSequenceNames(),
      )
    }

    let graphCoarseAssemblyMap: Map<string, string[]> | undefined
    if (this.graphCoarseAssemblyMapHandle) {
      const text = await this.graphCoarseAssemblyMapHandle.readFile('utf8')
      const json = JSON.parse(text) as { assemblies: Record<string, string[]> }
      graphCoarseAssemblyMap = new Map(Object.entries(json.assemblies))
    }

    return {
      genomes,
      chromSizes,
      posRefNames,
      syntenyRefNames,
      bubblesRefNames,
      bubblesGenomeNames,
      graphCoarseRefNames,
      graphCoarseAssemblyMap,
    }
  }

  private resolveTabixRefName(
    refNameSet: Set<string>,
    assemblyName: string,
    refName: string,
  ) {
    const qualified = `${assemblyName}#${refName}`
    if (refNameSet.has(qualified)) {
      return qualified
    }
    if (refNameSet.has(refName)) {
      return refName
    }
    const fileGenome = this.reverseAssemblyNameMap.get(assemblyName)
    if (fileGenome) {
      const fileQualified = `${fileGenome}#${refName}`
      if (refNameSet.has(fileQualified)) {
        return fileQualified
      }
    }
    return undefined
  }

  private resolveCoarseTabixRefName(
    refNameSet: Set<string>,
    assemblyName: string,
    refName: string,
    assemblyMap?: Map<string, string[]>,
  ) {
    const resolved = this.resolveTabixRefName(refNameSet, assemblyName, refName)
    if (resolved) {
      return resolved
    }
    if (!assemblyMap) {
      return undefined
    }
    // Direct key match: JBrowse assembly name == GFA assembly name
    const directPaths = assemblyMap.get(assemblyName)
    if (directPaths) {
      for (const p of directPaths) {
        if (p.endsWith(`#${refName}`) && refNameSet.has(p)) {
          return p
        }
      }
    }
    // Prefix match: JBrowse assembly name is a prefix of the GFA assembly key
    // (e.g. "grch38" matches "grch38#0")
    for (const [asmKey, asmPaths] of assemblyMap) {
      if (asmKey.startsWith(`${assemblyName}#`)) {
        for (const p of asmPaths) {
          if (p.endsWith(`#${refName}`) && refNameSet.has(p)) {
            return p
          }
        }
      }
    }
    return undefined
  }

  private remapGenome(genome: string) {
    return this.assemblyNameMap[genome] ?? genome
  }

  getAssemblyNames() {
    return [] as string[]
  }

  async getAssemblyNamesFromHeader() {
    const { genomes } = await this.setup()
    return genomes.map(g => this.remapGenome(g))
  }

  async getChromSizes() {
    const { chromSizes: raw } = await this.setup()
    const remapped = new Map<string, { refName: string; length: number }[]>()
    for (const [genome, sizes] of raw) {
      remapped.set(this.remapGenome(genome), sizes)
    }
    return remapped
  }

  async hasDataForRefName() {
    return true
  }

  async getRefNames() {
    return []
  }

  getFeatures(query: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const result = await this.getMultiPairFeatures(query, opts)
      const { assemblyName } = query

      for (const [queryGenome, features] of result.genomeRows) {
        for (const feat of features) {
          observer.next(
            new SyntenyFeature({
              uniqueId: `${feat.featureId}-${assemblyName}`,
              assemblyName,
              start: feat.start,
              end: feat.end,
              type: 'match',
              refName: query.refName,
              strand: feat.strand,
              syntenyId: +feat.featureId,
              identity: feat.identity,
              numMatches: 0,
              blockLen: 0,
              mate: {
                start: feat.mateStart,
                end: feat.mateEnd,
                refName: feat.mateRefName,
                assemblyName: queryGenome,
              },
            }),
          )
        }
      }
      observer.complete()
    })
  }

  async getSources() {
    const { genomes } = await this.setup()
    return genomes.map(g => ({ name: this.remapGenome(g) }))
  }

  async getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken } = {},
  ) {
    checkStopToken(opts.stopToken)
    const { syntenyRefNames, bubblesRefNames, bubblesGenomeNames } =
      await this.setup()

    const { bpPerPx = 1 } = opts
    const tabixFile =
      bpPerPx > 1000 && this.syntenyCoarseFile
        ? this.syntenyCoarseFile
        : this.syntenyFile

    const tabixRefName = this.resolveTabixRefName(
      syntenyRefNames,
      query.assemblyName,
      query.refName,
    )
    console.log(
      `[GfaTabixAdapter] getMultiPairFeatures ${JSON.stringify({ assemblyName: query.assemblyName, refName: query.refName, tabixRefName, syntenyRefNamesCount: syntenyRefNames.size })}`,
    )
    if (!tabixRefName) {
      return { genomeRows: new Map<string, MultiPairFeature[]>() }
    }

    const genomeRows = new Map<string, MultiPairFeature[]>()
    const checker = createStopTokenChecker(opts.stopToken)
    let rowIdx = 0

    await tabixFile.getLines(tabixRefName, query.start, query.end, {
      lineCallback: (line: string) => {
        checkStopToken2(checker)
        const cols = line.split('\t')
        if (cols.length < 8) {
          return
        }
        // refChrom  refStart  refEnd  hapChrom  hapStart  hapEnd  strand  identity
        const refStart = +cols[1]!
        const refEnd = +cols[2]!
        const hapChrom = cols[3]!
        const hapStart = +cols[4]!
        const hapEnd = +cols[5]!
        const strandStr = cols[6]!
        const identity = +cols[7]!

        const { genome: rawGenome, refName: mateRefName } =
          parseGfaPathName(hapChrom)
        const genomeName = this.remapGenome(rawGenome)
        const strand = strandStr === '-' ? -1 : 1

        const feat: MultiPairFeature = {
          queryGenome: genomeName,
          origRefName: query.refName,
          start: refStart,
          end: refEnd,
          mateStart: hapStart,
          mateEnd: hapEnd,
          mateRefName,
          strand,
          syriType: undefined,
          identity,
          featureId: String(rowIdx++),
          segmentId: undefined,
          cigar: undefined,
          cs: undefined,
        }

        let arr = genomeRows.get(genomeName)
        if (!arr) {
          arr = []
          genomeRows.set(genomeName, arr)
        }
        arr.push(feat)
      },
    })

    if (
      this.bubblesFile &&
      bpPerPx < 50 &&
      bubblesRefNames &&
      bubblesGenomeNames
    ) {
      const tabixBubbleRefName = this.resolveTabixRefName(
        bubblesRefNames,
        query.assemblyName,
        query.refName,
      )
      if (tabixBubbleRefName) {
        await annotateFeaturesWithBubbleCs({
          genomeRows,
          query,
          bubblesFile: this.bubblesFile,
          bubblesGenomeNames,
          tabixRefName: tabixBubbleRefName,
          reverseAssemblyNameMap: this.reverseAssemblyNameMap,
          stopToken: opts.stopToken,
        })
      }
    }

    const genomeSummary = [...genomeRows.entries()].map(
      ([g, fs]) => `${g}:${fs.length}`,
    )
    console.log(
      `[GfaTabixAdapter] getMultiPairFeatures result ${JSON.stringify({ tabixRefName, genomes: genomeSummary })}`,
    )
    return { genomeRows }
  }

  async getSubgraph(region: Region) {
    const { refName, start, end, assemblyName } = region
    console.log(
      `[GfaTabixAdapter] getSubgraph ${JSON.stringify({ refName, start, end, assemblyName })}`,
    )
    const {
      posRefNames,
      syntenyRefNames,
      graphCoarseRefNames,
      graphCoarseAssemblyMap,
    } = await this.setup()

    const tabixRefName = this.resolveTabixRefName(
      posRefNames,
      assemblyName,
      refName,
    )
    if (!tabixRefName) {
      return 'H\tVN:Z:1.1'
    }

    const regionSize = end - start
    if (regionSize > 100_000 && this.graphCoarseFile && graphCoarseRefNames) {
      const coarseTabixRefName = this.resolveCoarseTabixRefName(
        graphCoarseRefNames,
        assemblyName,
        refName,
        graphCoarseAssemblyMap,
      )
      if (coarseTabixRefName) {
        return this.getCoarseSubgraph(coarseTabixRefName, start, end)
      }
    }

    const refOrdinals = new Set<number>()
    await this.posFile.getLines(tabixRefName, start, end, {
      lineCallback: (line: string) => {
        parseOrdinalRanges(line, refOrdinals)
      },
    })

    interface HapRange {
      hapChrom: string
      hapStart: number
      hapEnd: number
    }
    const hapRanges: HapRange[] = []
    const syntenyTabixRefName = this.resolveTabixRefName(
      syntenyRefNames,
      assemblyName,
      refName,
    )
    if (syntenyTabixRefName) {
      await this.syntenyFile.getLines(syntenyTabixRefName, start, end, {
        lineCallback: (line: string) => {
          const cols = line.split('\t')
          hapRanges.push({
            hapChrom: cols[3]!,
            hapStart: +cols[4]!,
            hapEnd: +cols[5]!,
          })
        },
      })
    }

    const allOrdinals = new Set(refOrdinals)

    // Group haplotype ranges by path name and query pos.bed.gz once per path
    // (covering min..max of all its intervals) rather than once per block.
    // This reduces O(N*blocks) queries to O(N) — critical for 50+ haplotype datasets.
    const hapChromSpan = new Map<string, { minStart: number; maxEnd: number }>()
    for (const { hapChrom, hapStart, hapEnd } of hapRanges) {
      const existing = hapChromSpan.get(hapChrom)
      if (!existing) {
        hapChromSpan.set(hapChrom, { minStart: hapStart, maxEnd: hapEnd })
      } else {
        if (hapStart < existing.minStart) {
          existing.minStart = hapStart
        }
        if (hapEnd > existing.maxEnd) {
          existing.maxEnd = hapEnd
        }
      }
    }
    for (const [hapChrom, { minStart, maxEnd }] of hapChromSpan) {
      if (posRefNames.has(hapChrom)) {
        await this.posFile.getLines(hapChrom, minStart, maxEnd, {
          lineCallback: (line: string) => {
            parseOrdinalRanges(line, allOrdinals)
          },
        })
      }
    }

    if (allOrdinals.size === 0) {
      return 'H\tVN:Z:1.1'
    }

    const ordArr = [...allOrdinals].sort((a, b) => a - b)
    const minOrd = ordArr[0]!
    const maxOrd = ordArr[ordArr.length - 1]!

    const lines: string[] = ['H\tVN:Z:1.1']
    const emittedEdges = new Set<string>()
    if (this.edgesFile) {
      const edgesRefNames = new Set(
        await this.edgesFile.getReferenceSequenceNames(),
      )
      const edgesTabixRefName = this.resolveTabixRefName(
        edgesRefNames,
        assemblyName,
        refName,
      )
      if (edgesTabixRefName) {
        await this.edgesFile.getLines(edgesTabixRefName, start, end, {
          lineCallback: (line: string) => {
            const cols = line.split('\t')
            const src = +cols[3]!
            const tgt = +cols[4]!
            if (allOrdinals.has(src) && allOrdinals.has(tgt)) {
              const key = `${src}\t${cols[5]}\t${tgt}\t${cols[6]}`
              if (!emittedEdges.has(key)) {
                emittedEdges.add(key)
                lines.push(`L\t${src}\t${cols[5]}\t${tgt}\t${cols[6]}\t*`)
              }
            }
          },
        })
      }
    }

    const lenMap = new Map<number, number>()
    if (this.seqlensHandle) {
      const byteStart = minOrd * 4
      const byteLen = (maxOrd - minOrd + 1) * 4
      const buf = await this.seqlensHandle.read(byteLen, byteStart)
      const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
      for (const ord of ordArr) {
        lenMap.set(ord, view.getUint32((ord - minOrd) * 4, true))
      }
    }

    for (const ord of ordArr) {
      const len = lenMap.get(ord) ?? 1
      lines.push(`S\t${ord}\t*\tLN:i:${len}`)
    }

    const pathWalks = new Map<string, number[]>()
    await this.posFile.getLines(tabixRefName, start, end, {
      lineCallback: (line: string) => {
        const tab = line.indexOf('\t')
        const pathName = line.slice(0, tab)
        const ords = new Set<number>()
        parseOrdinalRanges(line, ords)
        let walk = pathWalks.get(pathName)
        if (!walk) {
          walk = []
          pathWalks.set(pathName, walk)
        }
        for (const ord of [...ords].sort((a, b) => a - b)) {
          if (allOrdinals.has(ord)) {
            walk.push(ord)
          }
        }
      },
    })

    for (const [hapChrom, { minStart, maxEnd }] of hapChromSpan) {
      if (posRefNames.has(hapChrom)) {
        await this.posFile.getLines(hapChrom, minStart, maxEnd, {
          lineCallback: (line: string) => {
            const tab = line.indexOf('\t')
            const pathName = line.slice(0, tab)
            const ords = new Set<number>()
            parseOrdinalRanges(line, ords)
            let walk = pathWalks.get(pathName)
            if (!walk) {
              walk = []
              pathWalks.set(pathName, walk)
            }
            for (const ord of [...ords].sort((a, b) => a - b)) {
              if (allOrdinals.has(ord)) {
                walk.push(ord)
              }
            }
          },
        })
      }
    }

    for (const [pathName, walk] of pathWalks) {
      if (walk.length > 0) {
        const parts = pathName.split('#')
        const assembly =
          parts.length >= 3 ? parts.slice(0, -1).join('#') : parts[0]!
        const chrom = parts[parts.length - 1]!
        const walkStr = walk.map(o => `>${o}`).join('')
        lines.push(`W\t${assembly}\t0\t${chrom}\t${start}\t${end}\t${walkStr}`)
      }
    }

    const gfa = lines.join('\n')
    console.log(
      `[GfaTabixAdapter] getSubgraph done: ${JSON.stringify({ slines: lines.filter(l => l.startsWith('S\t')).length, llines: lines.filter(l => l.startsWith('L\t')).length, wlines: lines.filter(l => l.startsWith('W\t')).length })}`,
    )
    return gfa
  }

  private async getCoarseSubgraph(
    tabixRefName: string,
    start: number,
    end: number,
  ) {
    const rows: CoarseRow[] = []
    await this.graphCoarseFile!.getLines(tabixRefName, start, end, {
      lineCallback: (line: string) => {
        const row = parseCoarseLine(line)
        if (row) {
          rows.push(row)
        }
      },
    })
    console.log(
      `[GfaTabixAdapter] getCoarseSubgraph done: ${JSON.stringify({ superSegments: rows.length })}`,
    )
    return coarseRowsToGfa(rows)
  }
}
