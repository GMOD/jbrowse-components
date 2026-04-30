import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { annotateFeaturesWithBubbleCs } from './bubbleAnnotator.ts'
import {
  mergeOrdinalRanges,
  parseGfaPathName,
  parsePosLineOrdinals,
} from './gfaBinaryIO.ts'
import { getSequencesForOrdinals } from './gfaSeqIO.ts'
import {
  buildGfaFromEdges,
  buildGfaFromPathInference,
} from './gfaSubgraphBuilders.ts'
import { buildFeaturesForPath } from './segmentFeatureBuilder.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { IndexedBinaryShard, SegRecord } from './gfaBinaryIO.ts'
import type { SeqShard } from './gfaSeqIO.ts'
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
  // 'walks' if the source GFA used W-lines, 'paths' if it used P-lines.
  // Adapter emits the same format on subgraph extraction (Phase 2). Older
  // indexes without `#input-format=` in the header default to 'paths'.
  inputFormat: 'walks' | 'paths'
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

// Open a tabix-indexed file pair if both locations are configured. Returns
// undefined when either side is empty (the optional-bubbles / sharded-only
// pattern at adapter setup).
function openTabixIfConfigured(
  loc: FileLocation | undefined,
  idxLoc: FileLocation | undefined,
  pm: PluginManager | undefined,
) {
  if (!hasFileLocation(loc) || !hasFileLocation(idxLoc)) {
    return undefined
  }
  return new TabixIndexedFile({
    filehandle: openLocation(loc, pm),
    tbiFilehandle: openLocation(idxLoc, pm),
    chunkCacheSize: 50 * 2 ** 20,
  })
}

export abstract class BaseGfaTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected posFile: TabixIndexedFile
  protected bubblesFile?: TabixIndexedFile
  private edgeShard?: IndexedBinaryShard
  private seqShard?: SeqShard
  private setupP?: Promise<SetupResult>

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
    pluginManager?: PluginManager,
  ) {
    super(config, getSubAdapter, pluginManager)
    const pm = this.pluginManager

    this.posFile = openTabixIfConfigured(
      this.getConf('posLocation') as FileLocation,
      this.getConf(['posIndex', 'location']) as FileLocation,
      pm,
    )!

    const edgesLoc = this.getConf('edgesLocation') as FileLocation | undefined
    if (hasFileLocation(edgesLoc)) {
      this.edgeShard = {
        filehandle: openLocation(edgesLoc, pm),
        idxFile: openLocation(
          this.getConf('edgesIdxLocation') as FileLocation,
          pm,
        ),
      }
    }

    const seqLoc = this.getConf('seqFastaLocation') as FileLocation | undefined
    if (hasFileLocation(seqLoc)) {
      this.seqShard = {
        fastaFile: openLocation(seqLoc, pm),
        idxFile: openLocation(
          this.getConf('seqIdxLocation') as FileLocation,
          pm,
        ),
      }
    }

    this.bubblesFile = openTabixIfConfigured(
      this.getConf('bubblesLocation') as FileLocation | undefined,
      this.getConf(['bubblesIndex', 'location']) as FileLocation | undefined,
      pm,
    )
  }

  protected abstract getSegsForOrdinals(
    ordinalRanges: [number, number][],
  ): Promise<SegRecord[]>

  private async fetchSegmentsForRegion(
    region: Region,
    opts: { stopToken?: StopToken },
  ) {
    const { posRefNames, pathNames, inputFormat } = await this.setup()
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
    return { segments, refPathIdx, pathNames, inputFormat }
  }

  private async setup() {
    this.setupP ??= this.setupPre()
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

    const formatMatch = /input-format=([^\n\s]+)/.exec(header)
    const inputFormat: 'walks' | 'paths' =
      formatMatch && formatMatch[1] === 'walks' ? 'walks' : 'paths'

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
      inputFormat,
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

  async getSubgraph(
    region: Region,
    opts: {
      stopToken?: StopToken
      maxPathsEmitted?: number
      context?: number
      emitFormat?: 'walks' | 'paths'
    } = {},
  ) {
    const result = await this.fetchSegmentsForRegion(region, opts)
    if (!result) {
      return ''
    }
    const { segments: allSegs, refPathIdx, pathNames, inputFormat } = result
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

    const seqShard = this.seqShard
    const fetchSeqs = seqShard
      ? (ords: number[]) => getSequencesForOrdinals(seqShard, ords)
      : undefined
    const buildOpts = {
      maxPathsEmitted: opts.maxPathsEmitted,
      context: opts.context,
      emitFormat: opts.emitFormat ?? inputFormat,
    }
    if (this.edgeShard) {
      return buildGfaFromEdges(
        viewportRefOrds,
        segLens,
        this.edgeShard,
        ranges => this.getSegsForOrdinals(ranges),
        pathNames,
        allSegs,
        fetchSeqs,
        buildOpts,
      )
    }

    return buildGfaFromPathInference(
      allSegs,
      refPathIdx,
      viewportRefOrds,
      segLens,
      pathNames,
      fetchSeqs,
      buildOpts,
    )
  }

  // C3 path-symmetry helper. Given a (refPath, refStart, refEnd) viewport,
  // return per-other-path coordinate ranges that overlap the same physical
  // segments. Used by the audit harness to query "the same locus" from N
  // different reference paths and assert structural fingerprints match.
  //
  // Algorithm: collect the set of segment ordinals that the ref path
  // traverses inside [refStart, refEnd], then for each other path that
  // visits any of those ordinals, take min(offset) and max(offset+segLen)
  // over the records sharing those ordinals. Returns a map keyed by the
  // unmapped (file-side) PanSN path name, e.g. `GRCh38#0#chr20`.
  async getEquivalentRanges(
    region: Region,
    opts: { stopToken?: StopToken } = {},
  ) {
    const result = await this.fetchSegmentsForRegion(region, opts)
    if (!result) {
      return new Map<string, { start: number; end: number }>()
    }
    const { segments: allSegs, refPathIdx, pathNames } = result
    const { start, end } = region

    const refOrds = new Set<number>()
    for (const rec of allSegs) {
      if (
        rec.pathNameIdx === refPathIdx &&
        rec.offset + rec.segLen > start &&
        rec.offset < end
      ) {
        refOrds.add(rec.segOrd)
      }
    }

    const ranges = new Map<string, { start: number; end: number }>()
    if (refOrds.size === 0) {
      return ranges
    }

    for (const rec of allSegs) {
      if (rec.pathNameIdx === refPathIdx) {
        continue
      }
      if (!refOrds.has(rec.segOrd)) {
        continue
      }
      const name = pathNames[rec.pathNameIdx]
      if (!name) {
        continue
      }
      const recEnd = rec.offset + rec.segLen
      const existing = ranges.get(name)
      if (!existing) {
        ranges.set(name, { start: rec.offset, end: recEnd })
      } else {
        if (rec.offset < existing.start) {
          existing.start = rec.offset
        }
        if (recEnd > existing.end) {
          existing.end = recEnd
        }
      }
    }
    return ranges
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
      const { bubblesRefNames, bubblesGenomeNames } = await this.setup()
      if (bubblesRefNames && bubblesGenomeNames) {
        const tabixRefName = this.resolveTabixRefName(
          bubblesRefNames,
          query.assemblyName,
          query.refName,
        )
        if (tabixRefName) {
          await annotateFeaturesWithBubbleCs({
            genomeRows,
            query,
            bubblesFile: this.bubblesFile,
            bubblesGenomeNames,
            tabixRefName,
            assemblyNameMap: this.getAssemblyNameMap(),
            stopToken: opts.stopToken,
          })
        }
      }
    }

    return genomeRows
  }
}

