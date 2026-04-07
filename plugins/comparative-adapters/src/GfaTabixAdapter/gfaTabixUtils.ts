import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import {
  mergeOrdinalRanges,
  parseGfaPathName,
  parsePosLineOrdinals,
} from './gfaBinaryIO.ts'

import {
  buildGfaFromEdges,
  buildGfaFromPathInference,
} from './gfaSubgraphBuilders.ts'
import { flipCs } from '../csUtils.ts'
import { buildFeaturesForPath } from './segmentFeatureBuilder.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { IndexedBinaryShard, SegRecord } from './gfaBinaryIO.ts'
import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { FileLocation, Region } from '@jbrowse/core/util/types'

interface SetupResult {
  genomes: string[]
  chromSizes: Map<string, { refName: string; length: number }[]>
  posRefNames: Set<string>
  pathNames: string[]
  bubblesRefNames?: Set<string>
  bubblesGenomeNames?: string[]
}

function hasFileLocation(loc: FileLocation | undefined): loc is FileLocation {
  if (!loc) {
    return false
  }
  if ('uri' in loc) {
    return loc.uri !== ''
  }
  if ('localPath' in loc) {
    return loc.localPath !== ''
  }
  if ('blobId' in loc) {
    return loc.blobId !== ''
  }
  return false
}

export abstract class BaseGfaTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected posFile: TabixIndexedFile
  protected bubblesFile?: TabixIndexedFile
  private edgeShard?: IndexedBinaryShard
  private setupP?: Promise<SetupResult>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    const posLoc = this.getConf('posLocation') as FileLocation
    const posIdxLoc = this.getConf(['posIndex', 'location']) as FileLocation

    this.posFile = new TabixIndexedFile({
      filehandle: openLocation(posLoc, pm),
      tbiFilehandle: openLocation(posIdxLoc, pm),
      chunkCacheSize: 50 * 2 ** 20,
    })

    const edgesLoc = this.getConf('edgesLocation') as FileLocation | undefined
    if (hasFileLocation(edgesLoc)) {
      const edgesIdxLoc = this.getConf('edgesIdxLocation') as FileLocation
      this.edgeShard = {
        filehandle: openLocation(edgesLoc, pm),
        idxFile: openLocation(edgesIdxLoc, pm),
      }
    }

    const bubblesLoc = this.getConf('bubblesLocation') as
      | FileLocation
      | undefined
    if (hasFileLocation(bubblesLoc)) {
      const bubblesIdxLoc = this.getConf([
        'bubblesIndex',
        'location',
      ]) as FileLocation
      this.bubblesFile = new TabixIndexedFile({
        filehandle: openLocation(bubblesLoc, pm),
        tbiFilehandle: openLocation(bubblesIdxLoc, pm),
        chunkCacheSize: 50 * 2 ** 20,
      })
    }
  }

  protected abstract getSegsForOrdinals(
    ordinalRanges: [number, number][],
  ): Promise<SegRecord[]>

  private async fetchSegmentsForRegion(
    region: Region,
    opts: { stopToken?: StopToken },
  ) {
    const { posRefNames, pathNames } = await this.setup()
    const { refName, start, end, assemblyName } = region
    const refPathName = this.resolveTabixRefName(
      posRefNames,
      assemblyName,
      refName,
    )
    if (!refPathName) {
      return undefined
    }
    const rawRanges: [number, number][] = []
    const posChecker = createStopTokenChecker(opts.stopToken)
    await this.posFile.getLines(refPathName, start, end, {
      lineCallback: (line: string) => {
        checkStopToken2(posChecker)
        parsePosLineOrdinals(line, rawRanges)
      },
    })
    if (rawRanges.length === 0) {
      return undefined
    }
    checkStopToken(opts.stopToken)
    const ordinalRanges = mergeOrdinalRanges(rawRanges)
    const segments = await this.getSegsForOrdinals(ordinalRanges)
    const refPathIdx = pathNames.indexOf(refPathName)
    return { segments, refPathIdx, pathNames }
  }

  private async setup() {
    if (!this.setupP) {
      this.setupP = this.setupPre()
    }
    return this.setupP
  }

  private async setupPre() {
    const header = await this.posFile.getHeader()
    const genomesMatch = /genomes=([^\n]+)/.exec(header)
    if (!genomesMatch) {
      console.warn(
        '[GfaTabixAdapter] pos.bed.gz header missing #genomes= line — genome names will be unavailable',
      )
    }
    const genomes = genomesMatch ? genomesMatch[1]!.split(',') : []

    const chromSizes = new Map<string, { refName: string; length: number }[]>()
    const sizesMatch = /sizes=([^\n]+)/.exec(header)
    if (!sizesMatch) {
      console.warn(
        '[GfaTabixAdapter] pos.bed.gz header missing #sizes= line — auto-assembly creation will not work',
      )
    }
    if (sizesMatch) {
      for (const entry of sizesMatch[1]!.split(',')) {
        const colonIdx = entry.lastIndexOf(':')
        if (colonIdx === -1) {
          continue
        }
        const { genome, refName } = parseGfaPathName(entry.slice(0, colonIdx))
        const length = +entry.slice(colonIdx + 1)
        if (!chromSizes.has(genome)) {
          chromSizes.set(genome, [])
        }
        chromSizes.get(genome)!.push({ refName, length })
      }
    }

    const posRefNames = new Set(await this.posFile.getReferenceSequenceNames())

    const pathsMatch = /paths=([^\n]+)/.exec(header)
    const pathNames = pathsMatch
      ? pathsMatch[1]!.split(',')
      : sizesMatch
        ? sizesMatch[1]!.split(',').map(entry => {
            const colonIdx = entry.lastIndexOf(':')
            return colonIdx !== -1 ? entry.slice(0, colonIdx) : entry
          })
        : []

    let bubblesRefNames: Set<string> | undefined
    let bubblesGenomeNames: string[] | undefined
    if (this.bubblesFile) {
      try {
        const bHeader = await this.bubblesFile.getHeader()
        bubblesRefNames = new Set(
          await this.bubblesFile.getReferenceSequenceNames(),
        )
        const gMatch = /genomes=([^\n]+)/.exec(bHeader)
        if (gMatch) {
          bubblesGenomeNames = gMatch[1]!.split(',')
        }
      } catch {
        // bubbles file not available
      }
    }

    return {
      genomes,
      chromSizes,
      posRefNames,
      pathNames,
      bubblesRefNames,
      bubblesGenomeNames,
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
    const nameMap = this.getAssemblyNameMap()
    for (const [orig, mapped] of Object.entries(nameMap)) {
      if (mapped === assemblyName) {
        const origQualified = `${orig}#${refName}`
        if (refNameSet.has(origQualified)) {
          return origQualified
        }
      }
    }
    return undefined
  }

  private getAssemblyNameMap() {
    return this.getConf('assemblyNameMap') as Record<string, string>
  }

  protected remapGenome(genome: string) {
    const map = this.getAssemblyNameMap()
    return map[genome] ?? genome
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
    const map = this.getAssemblyNameMap()
    if (Object.keys(map).length === 0) {
      return raw
    }
    const remapped = new Map<string, { refName: string; length: number }[]>()
    for (const [genome, sizes] of raw) {
      const mapped = map[genome] ?? genome
      remapped.set(mapped, sizes)
    }
    return remapped
  }

  public async hasDataForRefName() {
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
    opts: { bpPerPx?: number; stopToken?: BaseOptions['stopToken'] } = {},
  ) {
    checkStopToken(opts.stopToken)
    const genomeRows = await this.getMultiPairFeaturesFromSegments(query, opts)
    return { genomeRows }
  }

  async getSubgraph(region: Region, opts: { stopToken?: StopToken } = {}) {
    const result = await this.fetchSegmentsForRegion(region, opts)
    if (!result) {
      return ''
    }
    const { segments: allSegs, refPathIdx, pathNames } = result
    const { start, end } = region

    const viewportRefOrds: number[] = []
    const segLens = new Map<number, number>()

    for (const rec of allSegs) {
      if (
        rec.pathNameIdx === refPathIdx &&
        rec.offset + rec.segLen > start &&
        rec.offset < end
      ) {
        viewportRefOrds.push(rec.segOrd)
        segLens.set(rec.segOrd, rec.segLen)
      }
    }

    if (viewportRefOrds.length === 0) {
      return ''
    }

    if (this.edgeShard) {
      return buildGfaFromEdges(viewportRefOrds, segLens, this.edgeShard)
    }

    return buildGfaFromPathInference(
      allSegs,
      refPathIdx,
      viewportRefOrds,
      segLens,
      pathNames,
    )
  }

  private async getMultiPairFeaturesFromSegments(
    query: Region,
    opts: { stopToken?: StopToken; bpPerPx?: number } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const result = await this.fetchSegmentsForRegion(query, opts)
    if (!result) {
      return genomeRows
    }
    const { segments: allSegs, refPathIdx, pathNames } = result
    const { refName } = query
    const refSegments: SegRecord[] = []
    const otherSegments = new Map<number, SegRecord[]>()

    for (const rec of allSegs) {
      if (rec.pathNameIdx === refPathIdx) {
        refSegments.push(rec)
      } else {
        if (!otherSegments.has(rec.pathNameIdx)) {
          otherSegments.set(rec.pathNameIdx, [])
        }
        otherSegments.get(rec.pathNameIdx)!.push(rec)
      }
    }

    const refByOrd = new Map(refSegments.map(s => [s.segOrd, s]))

    for (const [otherPathIdx, segments] of otherSegments) {
      const otherPath = pathNames[otherPathIdx] ?? String(otherPathIdx)
      const { genome: rawGenome, refName: mateRefName } =
        parseGfaPathName(otherPath)
      const genomeName = this.remapGenome(rawGenome)

      const features = buildFeaturesForPath(
        segments,
        refByOrd,
        genomeName,
        refName,
        mateRefName,
        otherPath,
      )
      if (features.length > 0) {
        if (!genomeRows.has(genomeName)) {
          genomeRows.set(genomeName, [])
        }
        const existing = genomeRows.get(genomeName)!
        for (const f of features) {
          existing.push(f)
        }
      }
    }

    if (this.bubblesFile && opts.bpPerPx && opts.bpPerPx < 50) {
      await this.annotateFeaturesWithBubbleCs(genomeRows, query, opts)
    }

    return genomeRows
  }

  private async annotateFeaturesWithBubbleCs(
    genomeRows: Map<string, MultiPairFeature[]>,
    query: Region,
    opts: { stopToken?: StopToken },
  ) {
    const { bubblesRefNames, bubblesGenomeNames } = await this.setup()
    if (!bubblesRefNames || !bubblesGenomeNames) {
      return
    }

    const { refName, start, end, assemblyName } = query
    const tabixRefName = this.resolveTabixRefName(
      bubblesRefNames,
      assemblyName,
      refName,
    )
    if (!tabixRefName) {
      return
    }

    const genomeIdx = new Map<string, number>()
    for (let i = 0; i < bubblesGenomeNames.length; i++) {
      genomeIdx.set(bubblesGenomeNames[i]!, i)
    }

    const bubbles: {
      start: number
      end: number
      alleleA: number
      alleleB: number
      identity: number
      cs: string
      genomesA: Set<number>
      genomesB: Set<number>
    }[] = []

    const checker = createStopTokenChecker(opts.stopToken)
    await this.bubblesFile!.getLines(tabixRefName, start, end, {
      lineCallback: (line: string) => {
        checkStopToken2(checker)
        const cols = line.split('\t')
        const bStart = +cols[1]!
        const bEnd = +cols[2]!
        const alleleA = +cols[3]!
        const alleleB = +cols[4]!
        const identity = +cols[5]!
        const cs = cols[6] ?? ''
        const genomesA = new Set(
          (cols[7] ?? '')
            .split(',')
            .filter(s => s.length > 0)
            .map(Number),
        )
        const genomesB = new Set(
          (cols[8] ?? '')
            .split(',')
            .filter(s => s.length > 0)
            .map(Number),
        )
        bubbles.push({
          start: bStart,
          end: bEnd,
          alleleA,
          alleleB,
          identity,
          cs,
          genomesA,
          genomesB,
        })
      },
    })

    if (bubbles.length === 0) {
      return
    }

    bubbles.sort((a, b) => a.start - b.start || a.end - b.end)

    const nameMap = this.getAssemblyNameMap()
    const reverseNameMap = new Map<string, string>()
    for (const [orig, mapped] of Object.entries(nameMap)) {
      reverseNameMap.set(mapped, orig)
    }

    const refOrigName = reverseNameMap.get(assemblyName) ?? assemblyName
    const refGenomeIdx =
      genomeIdx.get(refOrigName) ?? genomeIdx.get(assemblyName)

    for (const [genomeName, features] of genomeRows) {
      const origName = reverseNameMap.get(genomeName) ?? genomeName
      const gIdx = genomeIdx.get(origName) ?? genomeIdx.get(genomeName)
      if (gIdx === undefined) {
        continue
      }

      for (const feat of features) {
        let lo = 0
        let hi = bubbles.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (bubbles[mid]!.end <= feat.start) {
            lo = mid + 1
          } else {
            hi = mid
          }
        }

        if (lo >= bubbles.length || bubbles[lo]!.start >= feat.end) {
          continue
        }

        const csParts: string[] = []
        let identityMatchBp = 0
        let identityTotalBp = 0
        let pos = feat.start
        let bi = lo

        while (bi < bubbles.length && bubbles[bi]!.start < feat.end) {
          const locusStart = bubbles[bi]!.start
          const locusEnd = bubbles[bi]!.end
          const locusLen = locusEnd - locusStart

          if (locusStart > pos) {
            const gap = locusStart - pos
            csParts.push(`:${gap}`)
            identityMatchBp += gap
            identityTotalBp += gap
          }

          // Scan all bubble records at this locus (contiguous since sorted)
          const locusBegin = bi
          while (
            bi < bubbles.length &&
            bubbles[bi]!.start === locusStart &&
            bubbles[bi]!.end === locusEnd
          ) {
            bi++
          }

          // Find which alleles this genome and the ref carry at this locus
          const pairRecord = findBubblePairRecord(
            bubbles,
            locusBegin,
            bi,
            gIdx,
            refGenomeIdx,
          )

          if (pairRecord) {
            csParts.push(pairRecord.cs)
            identityMatchBp += pairRecord.identity * locusLen
          } else {
            csParts.push(`:${locusLen}`)
            identityMatchBp += locusLen
          }
          identityTotalBp += locusLen
          pos = locusEnd
        }

        if (pos < feat.end) {
          const trailing = feat.end - pos
          csParts.push(`:${trailing}`)
          identityMatchBp += trailing
          identityTotalBp += trailing
        }
        feat.cs = csParts.join('')
        if (identityTotalBp > 0) {
          feat.identity = identityMatchBp / identityTotalBp
        }
      }
    }
  }
}

interface BubbleEntry {
  alleleA: number
  alleleB: number
  identity: number
  cs: string
  genomesA: Set<number>
  genomesB: Set<number>
}

function findAlleleForGenome(
  bubbles: BubbleEntry[],
  begin: number,
  end: number,
  gIdx: number,
) {
  for (let i = begin; i < end; i++) {
    const r = bubbles[i]!
    if (r.genomesA.has(gIdx)) {
      return r.alleleA
    }
    if (r.genomesB.has(gIdx)) {
      return r.alleleB
    }
  }
  return undefined
}

export function findBubblePairRecord(
  bubbles: BubbleEntry[],
  begin: number,
  end: number,
  gIdx: number,
  refGenomeIdx: number | undefined,
): { cs: string; identity: number } | undefined {
  const queryAllele = findAlleleForGenome(bubbles, begin, end, gIdx)
  const viewRefAllele =
    refGenomeIdx !== undefined
      ? (findAlleleForGenome(bubbles, begin, end, refGenomeIdx) ?? 0)
      : 0

  if (queryAllele === undefined || queryAllele === viewRefAllele) {
    return undefined
  }

  const lo = Math.min(viewRefAllele, queryAllele)
  const hi = Math.max(viewRefAllele, queryAllele)
  const needsFlip = viewRefAllele > queryAllele
  for (let i = begin; i < end; i++) {
    const r = bubbles[i]!
    if (r.alleleA === lo && r.alleleB === hi) {
      return {
        cs: needsFlip ? flipCs(r.cs) : r.cs,
        identity: r.identity,
      }
    }
  }
  return undefined
}
