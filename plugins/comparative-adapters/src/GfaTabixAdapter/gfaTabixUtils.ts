import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken2,
  checkStopToken,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { FileLocation, Region } from '@jbrowse/core/util/types'
import type { GenericFilehandle } from 'generic-filehandle2'

export interface SegRecord {
  segOrd: number
  pathNameIdx: number
  offset: number
  segLen: number
  orient: number // char code: 0x2B '+' or 0x2D '-'
}

export interface SegmentsShard {
  filehandle: GenericFilehandle
  idxFile: GenericFilehandle
  idxPromise?: Promise<BigUint64Array>
}

interface SetupResult {
  genomes: string[]
  chromSizes: Map<string, { refName: string; length: number }[]>
  posRefNames: Set<string>
  pathNames: string[]
  bubblesAvailable: boolean
  bubblesRefNames?: Set<string>
  bubblesGenomeNames?: string[]
}

export function parseGfaPathName(path: string) {
  const parts = path.split('#')
  if (parts.length >= 3) {
    return {
      genome: parts.slice(0, -1).join('#'),
      refName: parts[parts.length - 1]!,
    }
  }
  return { genome: parts[0]!, refName: parts[1] ?? parts[0]! }
}

const RECORD_SIZE = 15

const ORIENT_FWD = 0x2b // '+'

export function parseSegmentsBinary(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = Math.floor(buf.byteLength / RECORD_SIZE)
  const records = new Array<SegRecord>(count)
  for (let i = 0; i < count; i++) {
    const off = i * RECORD_SIZE
    records[i] = {
      segOrd: dv.getUint32(off, true),
      pathNameIdx: dv.getUint16(off + 4, true),
      offset: dv.getUint32(off + 6, true),
      segLen: dv.getUint32(off + 10, true),
      orient: buf[buf.byteOffset + off + 14]!,
    }
  }
  return records
}

export async function loadSegmentsIndex(shard: SegmentsShard) {
  if (!shard.idxPromise) {
    shard.idxPromise = shard.idxFile.readFile().then(buf => {
      const aligned = new ArrayBuffer(buf.byteLength)
      new Uint8Array(aligned).set(buf)
      return new BigUint64Array(aligned)
    })
  }
  return shard.idxPromise
}

// Merge thresholds for combining nearby byte ranges into single reads
const MERGE_GAP = 65_000
const MAX_MERGED_BYTES = 20 * 1024 * 1024

export async function getSegmentsForOrdinalsFromShard(
  shard: SegmentsShard,
  ordinalRanges: [number, number][],
) {
  const idx = await loadSegmentsIndex(shard)

  const merged: { start: number; end: number }[] = []
  for (const [lo, hi] of ordinalRanges) {
    if (lo >= 0 && hi + 1 < idx.length) {
      const start = Number(idx[lo]!)
      const end = Number(idx[hi + 1]!)
      if (end > start) {
        const prev = merged.length > 0 ? merged[merged.length - 1]! : undefined
        if (
          prev &&
          start - prev.end < MERGE_GAP &&
          end - prev.start < MAX_MERGED_BYTES
        ) {
          prev.end = Math.max(prev.end, end)
        } else {
          merged.push({ start, end })
        }
      }
    }
  }

  const results = await Promise.all(
    merged.map(async range => {
      const length = range.end - range.start
      const t0 = performance.now()
      const bytes = await shard.filehandle.read(length, range.start)
      const t1 = performance.now()
      const records = parseSegmentsBinary(bytes)
      const t2 = performance.now()
      console.log(
        `  read ${(t1 - t0).toFixed(0)}ms, parse ${(t2 - t1).toFixed(0)}ms,` +
          ` ${(length / 1024 / 1024).toFixed(2)} MB, ${records.length} records`,
      )
      return records
    }),
  )
  return results.flat()
}

function parsePosLineOrdinals(line: string, out: [number, number][]) {
  let t = 0
  for (let n = 0; n < 3; n++) {
    t = line.indexOf('\t', t) + 1
  }
  const t5 = line.indexOf('\t', t)
  const col4 = line.slice(t, t5 !== -1 ? t5 : undefined)

  if (t5 !== -1) {
    out.push([+col4, +line.slice(t5 + 1)])
  } else if (col4.includes('-') || col4.includes(',')) {
    let i = 0
    while (i < col4.length) {
      let j = col4.indexOf(',', i)
      if (j === -1) {
        j = col4.length
      }
      const token = col4.slice(i, j)
      const dash = token.indexOf('-')
      if (dash > 0) {
        out.push([+token.slice(0, dash), +token.slice(dash + 1)])
      } else {
        out.push([+token, +token])
      }
      i = j + 1
    }
  } else {
    out.push([+col4, +col4])
  }
}

function mergeOrdinalRanges(rawRanges: [number, number][]) {
  rawRanges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [lo, hi] of rawRanges) {
    const prev = merged.length > 0 ? merged[merged.length - 1]! : undefined
    if (prev && lo <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], hi)
    } else {
      merged.push([lo, hi])
    }
  }
  return merged
}

export abstract class BaseGfaTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected posFile: TabixIndexedFile
  protected bubblesFile?: TabixIndexedFile
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

    const bubblesLoc = this.getConf('bubblesLocation') as
      | FileLocation
      | undefined
    const hasBubblesLoc =
      bubblesLoc &&
      (('uri' in bubblesLoc && bubblesLoc.uri !== '') ||
        ('localPath' in bubblesLoc && bubblesLoc.localPath !== ''))
    if (hasBubblesLoc) {
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

    let bubblesAvailable = false
    let bubblesRefNames: Set<string> | undefined
    let bubblesGenomeNames: string[] | undefined
    if (this.bubblesFile) {
      try {
        const bHeader = await this.bubblesFile.getHeader()
        bubblesRefNames = new Set(
          await this.bubblesFile.getReferenceSequenceNames(),
        )
        bubblesAvailable = true
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
      bubblesAvailable,
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
    // Try reverse-mapped original name from assemblyNameMap
    // e.g. assemblyName="volvox" → original="volvox#0" → try "volvox#0#ctgA"
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
    const { posRefNames, pathNames } = await this.setup()
    const { refName, start, end, assemblyName } = region

    const refPathName = this.resolveTabixRefName(
      posRefNames,
      assemblyName,
      refName,
    )
    if (!refPathName) {
      return ''
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
      return ''
    }

    checkStopToken(opts.stopToken)
    const allSegs = await this.getSegsForOrdinals(mergeOrdinalRanges(rawRanges))

    const segLens = new Map<number, number>()
    const pathSegRecords = new Map<
      number,
      { segOrd: number; orient: number; offset: number }[]
    >()

    for (const rec of allSegs) {
      segLens.set(rec.segOrd, rec.segLen)
      if (!pathSegRecords.has(rec.pathNameIdx)) {
        pathSegRecords.set(rec.pathNameIdx, [])
      }
      pathSegRecords
        .get(rec.pathNameIdx)!
        .push({ segOrd: rec.segOrd, orient: rec.orient, offset: rec.offset })
    }

    for (const segs of pathSegRecords.values()) {
      segs.sort((a, b) => a.offset - b.offset)
    }

    const links = new Set<string>()
    for (const segs of pathSegRecords.values()) {
      for (let i = 0; i < segs.length - 1; i++) {
        const a = segs[i]!
        const b = segs[i + 1]!
        const oA = a.orient === ORIENT_FWD ? '+' : '-'
        const oB = b.orient === ORIENT_FWD ? '+' : '-'
        links.add(`L\ts${a.segOrd}\t${oA}\ts${b.segOrd}\t${oB}\t*`)
      }
    }

    const lines: string[] = ['H\tVN:Z:1.1']
    for (const [ord, len] of segLens) {
      lines.push(`S\ts${ord}\t*\tLN:i:${len}`)
    }
    for (const link of links) {
      lines.push(link)
    }
    for (const [pathIdx, segs] of pathSegRecords) {
      const pathName = pathNames[pathIdx]
      if (!pathName) {
        continue
      }
      const walk = segs
        .map(s => `s${s.segOrd}${s.orient === ORIENT_FWD ? '+' : '-'}`)
        .join(',')
      lines.push(`P\t${pathName}\t${walk}\t*`)
    }

    return lines.join('\n')
  }

  private async getMultiPairFeaturesFromSegments(
    query: Region,
    opts: { stopToken?: StopToken } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const { refName, start, end, assemblyName } = query

    const { posRefNames, pathNames } = await this.setup()
    const refPathName = this.resolveTabixRefName(
      posRefNames,
      assemblyName,
      refName,
    )
    if (!refPathName) {
      return genomeRows
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
      return genomeRows
    }

    const ordinalRanges = mergeOrdinalRanges(rawRanges)

    checkStopToken(opts.stopToken)
    const allSegs = await this.getSegsForOrdinals(ordinalRanges)
    const refPathIdx = pathNames.indexOf(refPathName)
    const refSegments: SegRecord[] = []
    const otherSegments = new Map<number, SegRecord[]>()

    console.log(
      `[getMultiPairFeaturesFromSegments] refPathName=${refPathName} refPathIdx=${refPathIdx} pathNames.length=${pathNames.length} allSegs=${allSegs.length} ordinalRanges=${ordinalRanges.length}`,
    )
    if (allSegs.length > 0) {
      const sample = allSegs.slice(0, 3)
      console.log(
        `[getMultiPairFeaturesFromSegments] sample segs:`,
        sample.map(
          s =>
            `ord=${s.segOrd} pathIdx=${s.pathNameIdx} off=${s.offset} len=${s.segLen}`,
        ),
      )
      const uniquePathIdxs = new Set(allSegs.map(s => s.pathNameIdx))
      console.log(
        `[getMultiPairFeaturesFromSegments] unique pathNameIdx values:`,
        [...uniquePathIdxs].slice(0, 10),
        `(${uniquePathIdxs.size} total)`,
      )
    }

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

    console.log(
      `[getMultiPairFeaturesFromSegments] refSegments=${refSegments.length} otherSegments groups=${otherSegments.size}`,
    )

    const refByOrd = new Map(refSegments.map(s => [s.segOrd, s]))

    // Debug: analyze ref segment coverage to see if there's a gap in ref itself
    {
      const sortedRef = [...refSegments].sort((a, b) => a.offset - b.offset)
      let prevEnd = 0
      const gaps: string[] = []
      for (const seg of sortedRef) {
        if (seg.offset > prevEnd + 100) {
          gaps.push(
            `${(prevEnd / 1e6).toFixed(3)}-${(seg.offset / 1e6).toFixed(3)}Mb (${((seg.offset - prevEnd) / 1000).toFixed(1)}kb)`,
          )
        }
        prevEnd = Math.max(prevEnd, seg.offset + seg.segLen)
      }
      const refMin = sortedRef[0]?.offset ?? 0
      const lastSeg = sortedRef[sortedRef.length - 1]
      const refMax = lastSeg ? lastSeg.offset + lastSeg.segLen : 0
      // 50kb bucket distribution of ref segments
      const bucketSize = 50_000
      const refBuckets = new Map<number, number>()
      for (const seg of sortedRef) {
        const bucket = Math.floor(seg.offset / bucketSize) * bucketSize
        refBuckets.set(bucket, (refBuckets.get(bucket) ?? 0) + 1)
      }
      const refBucketStr = [...refBuckets.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([bp, count]) => `${(bp / 1e6).toFixed(2)}Mb:${count}`)

      console.log(
        `[getMultiPairFeaturesFromSegments] refSegments coverage: ${(refMin / 1e6).toFixed(3)}-${(refMax / 1e6).toFixed(3)}Mb`,
        `gaps>100bp: ${gaps.length === 0 ? 'none' : gaps.join(', ')}`,
      )
      console.log(
        `[getMultiPairFeaturesFromSegments] refSeg 50kb buckets:`,
        refBucketStr,
      )
    }

    // Debug: for first genome, log matched vs unmatched segment counts
    let firstGenomeLogged = false

    for (const [otherPathIdx, segments] of otherSegments) {
      const otherPath = pathNames[otherPathIdx] ?? String(otherPathIdx)
      const { genome: rawGenome, refName: mateRefName } =
        parseGfaPathName(otherPath)
      const genomeName = this.remapGenome(rawGenome)

      if (!genomeRows.has(genomeName)) {
        genomeRows.set(genomeName, [])
      }
      const features = genomeRows.get(genomeName)!

      // Collect matched segment indices and sort by ref offset to ensure
      // correct merge order. We avoid creating wrapper objects by using
      // parallel index arrays.
      const matchIdx: number[] = []
      const matchRefOff: number[] = []
      for (let j = 0; j < segments.length; j++) {
        const seg = segments[j]!
        if (refByOrd.has(seg.segOrd)) {
          matchIdx.push(j)
          matchRefOff.push(refByOrd.get(seg.segOrd)!.offset)
        }
      }
      // Debug: for first few genomes, log match details
      if (!firstGenomeLogged) {
        const unmatchedCount = segments.length - matchIdx.length
        const matchedRefOffsets = matchRefOff.sort((a, b) => a - b)
        const matchedMin = matchedRefOffsets[0] ?? 0
        const matchedMax = matchedRefOffsets[matchedRefOffsets.length - 1] ?? 0
        console.log(
          `[getMultiPairFeaturesFromSegments] genome ${genomeName} (pathIdx=${otherPathIdx}):`,
          `${segments.length} total segs, ${matchIdx.length} matched, ${unmatchedCount} unmatched`,
          `matched ref range: ${(matchedMin / 1e6).toFixed(3)}-${(matchedMax / 1e6).toFixed(3)}Mb`,
        )
        firstGenomeLogged = true
      }

      if (matchIdx.length === 0) {
        continue
      }
      const sortOrder = Array.from({ length: matchIdx.length }, (_, i) => i)
      sortOrder.sort((a, b) => matchRefOff[a]! - matchRefOff[b]!)
      let ms = -1
      let me = -1
      let mms = -1
      let mme = -1
      let mStrand = 0
      let mOrd = -1
      let matchBp = 0
      let cigarParts: string[] = []
      let runMatchLen = 0
      for (let si = 0; si < sortOrder.length; si++) {
        const seg = segments[matchIdx[sortOrder[si]!]!]!
        const refSeg = refByOrd.get(seg.segOrd)!

        const strand = seg.orient === refSeg.orient ? 1 : -1
        const rs = refSeg.offset
        const re = refSeg.offset + refSeg.segLen
        const qs = seg.offset
        const qe = seg.offset + seg.segLen

        if (ms < 0 || strand !== mStrand) {
          if (runMatchLen > 0) {
            cigarParts.push(`${runMatchLen}=`)
            matchBp += runMatchLen
            runMatchLen = 0
          }
          if (ms >= 0) {
            features.push({
              queryGenome: genomeName,
              origRefName: refName,
              start: ms,
              end: me,
              mateStart: mms,
              mateEnd: mme,
              mateRefName,
              strand: mStrand,
              syriType: undefined,
              identity: me > ms ? matchBp / (me - ms) : 1,
              featureId: `gfa-${mOrd}-${otherPath}`,
              segmentId: undefined,
              cigar: cigarParts.length > 1 ? cigarParts.join('') : undefined,
              cs: undefined,
            })
            cigarParts = []
            matchBp = 0
          }
          ms = rs
          me = re
          mms = qs
          mme = qe
          mStrand = strand
          mOrd = refSeg.segOrd
          runMatchLen = refSeg.segLen
          continue
        }

        const refGap = rs - me
        const queryGap = mStrand === 1 ? qs - mme : mms - qe

        if (refGap < 0 || queryGap < 0) {
          if (runMatchLen > 0) {
            cigarParts.push(`${runMatchLen}=`)
            matchBp += runMatchLen
            runMatchLen = 0
          }
          if (ms >= 0) {
            features.push({
              queryGenome: genomeName,
              origRefName: refName,
              start: ms,
              end: me,
              mateStart: mms,
              mateEnd: mme,
              mateRefName,
              strand: mStrand,
              syriType: undefined,
              identity: me > ms ? matchBp / (me - ms) : 1,
              featureId: `gfa-${mOrd}-${otherPath}`,
              segmentId: undefined,
              cigar: cigarParts.length > 1 ? cigarParts.join('') : undefined,
              cs: undefined,
            })
            cigarParts = []
            matchBp = 0
          }
          ms = rs
          me = re
          mms = qs
          mme = qe
          mOrd = refSeg.segOrd
          runMatchLen = refSeg.segLen
          continue
        }

        if (refGap > 0 || queryGap > 0) {
          if (runMatchLen > 0) {
            cigarParts.push(`${runMatchLen}=`)
            matchBp += runMatchLen
            runMatchLen = 0
          }
          if (refGap > 0) {
            cigarParts.push(`${refGap}D`)
          }
          if (queryGap > 0) {
            cigarParts.push(`${queryGap}I`)
          }
        }

        runMatchLen += refSeg.segLen
        me = re
        if (mStrand === 1) {
          mme = qe
        } else {
          mms = qs
        }
      }

      {
        if (runMatchLen > 0) {
          cigarParts.push(`${runMatchLen}=`)
          matchBp += runMatchLen
        }
        if (ms >= 0) {
          features.push({
            queryGenome: genomeName,
            origRefName: refName,
            start: ms,
            end: me,
            mateStart: mms,
            mateEnd: mme,
            mateRefName,
            strand: mStrand,
            syriType: undefined,
            identity: me > ms ? matchBp / (me - ms) : 1,
            featureId: `gfa-${mOrd}-${otherPath}`,
            segmentId: undefined,
            cigar: cigarParts.length > 1 ? cigarParts.join('') : undefined,
            cs: undefined,
          })
        }
      }
    }

    let fwdCount = 0
    let revCount = 0
    let globalMinBp = Infinity
    let globalMaxBp = 0
    let totalFeatures = 0
    for (const [genomeName, features] of genomeRows) {
      for (const f of features) {
        if (f.strand === -1) {
          revCount++
        } else {
          fwdCount++
        }
        if (f.start < globalMinBp) {
          globalMinBp = f.start
        }
        if (f.end > globalMaxBp) {
          globalMaxBp = f.end
        }
        totalFeatures++
      }
    }
    console.log(
      `[getMultiPairFeaturesFromSegments] strand distribution: fwd=${fwdCount} rev=${revCount} (${((revCount / (fwdCount + revCount)) * 100).toFixed(1)}% inversions)`,
    )
    console.log(
      `[getMultiPairFeaturesFromSegments] feature bp coverage: ${globalMinBp.toLocaleString()}-${globalMaxBp.toLocaleString()}`,
      `query range: ${refName}:${start.toLocaleString()}-${end.toLocaleString()}`,
      `features cover ${(((globalMaxBp - globalMinBp) / (end - start)) * 100).toFixed(1)}% of query`,
      `total features: ${totalFeatures} across ${genomeRows.size} genomes`,
    )

    // Log per-genome coverage to spot if some genomes have features only in part of range
    const coverageSummary: string[] = []
    for (const [genomeName, features] of genomeRows) {
      if (features.length > 0) {
        const gMin = Math.min(...features.map(f => f.start))
        const gMax = Math.max(...features.map(f => f.end))
        coverageSummary.push(
          `${genomeName}: ${features.length} feats ${(gMin / 1e6).toFixed(2)}-${(gMax / 1e6).toFixed(2)}Mb`,
        )
      }
    }
    if (coverageSummary.length <= 10) {
      console.log(
        `[getMultiPairFeaturesFromSegments] per-genome:`,
        coverageSummary,
      )
    } else {
      console.log(
        `[getMultiPairFeaturesFromSegments] first 5 genomes:`,
        coverageSummary.slice(0, 5),
      )
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

    // Build genome name → index map from bubbles header
    const genomeIdx = new Map<string, number>()
    for (let i = 0; i < bubblesGenomeNames.length; i++) {
      genomeIdx.set(bubblesGenomeNames[i]!, i)
    }

    // Load all bubble records in the visible region
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

    // Sort bubbles by position for correct CS assembly
    bubbles.sort((a, b) => a.start - b.start || a.end - b.end)

    // Build a lookup: (start, end) → list of bubble records at that locus.
    // A single VCF site with N alleles produces C(N,2) pairwise records that
    // all share the same (start, end).
    const locusBubbles = new Map<string, typeof bubbles>()
    for (const b of bubbles) {
      const key = `${b.start}:${b.end}`
      const list = locusBubbles.get(key)
      if (list) {
        list.push(b)
      } else {
        locusBubbles.set(key, [b])
      }
    }

    // Build genome name → index map using both original and remapped names
    const nameMap = this.getAssemblyNameMap()

    let matchedGenomes = 0
    let unmatchedGenomes = 0
    for (const [genomeName, features] of genomeRows) {
      // Try both the remapped name and reverse-mapped original name
      const origName =
        Object.entries(nameMap).find(([, v]) => v === genomeName)?.[0] ??
        genomeName
      const gIdx = genomeIdx.get(origName) ?? genomeIdx.get(genomeName)
      if (gIdx === undefined) {
        unmatchedGenomes++
        continue
      }
      matchedGenomes++

      // Determine which allele index the view's ref assembly corresponds to.
      // In the VCF from vg deconstruct, allele 0 is the reference used in the
      // deconstruct command (e.g. GRCh38). The view's assemblyName may or may
      // not be that same assembly.  We resolve the ref assembly's genome index
      // in the bubbles header and check: if it is allele 0 for bubble records,
      // the view is ref-centric; otherwise we need to find the correct pair.
      const refOrigName =
        Object.entries(nameMap).find(([, v]) => v === assemblyName)?.[0] ??
        assemblyName

      // The ref genome of the VCF is always allele 0 by convention (from vg
      // deconstruct).  If the view's ref assembly matches the VCF ref, refAllele=0.
      // Otherwise we need to find its allele index per-locus.
      const refGenomeIdx =
        genomeIdx.get(refOrigName) ?? genomeIdx.get(assemblyName)

      for (const feat of features) {
        // Binary search for the first bubble that could overlap this feature.
        // Bubbles are sorted by start, so find first where end > feat.start.
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

        // Collect unique loci directly from the sorted scan
        const uniqueLoci: { start: number; end: number }[] = []
        let prevStart = -1
        let prevEnd = -1
        for (let bi = lo; bi < bubbles.length; bi++) {
          const b = bubbles[bi]!
          if (b.start >= feat.end) {
            break
          }
          if (b.start !== prevStart || b.end !== prevEnd) {
            uniqueLoci.push({ start: b.start, end: b.end })
            prevStart = b.start
            prevEnd = b.end
          }
        }
        if (uniqueLoci.length === 0) {
          continue
        }

        const csParts: string[] = []
        let identityMatchBp = 0
        let identityTotalBp = 0
        let pos = feat.start
        for (const locus of uniqueLoci) {
          if (locus.start > pos) {
            const gap = locus.start - pos
            csParts.push(`:${gap}`)
            identityMatchBp += gap
            identityTotalBp += gap
          }

          const locusKey = `${locus.start}:${locus.end}`
          const records = locusBubbles.get(locusKey) ?? []
          const locusLen = locus.end - locus.start

          // Find which allele this genome carries at this locus
          let queryAllele: number | undefined
          for (const r of records) {
            if (r.genomesA.has(gIdx)) {
              queryAllele = r.alleleA
              break
            }
            if (r.genomesB.has(gIdx)) {
              queryAllele = r.alleleB
              break
            }
          }

          // Find which allele the ref assembly carries
          let viewRefAllele: number | undefined
          if (refGenomeIdx !== undefined) {
            for (const r of records) {
              if (r.genomesA.has(refGenomeIdx)) {
                viewRefAllele = r.alleleA
                break
              }
              if (r.genomesB.has(refGenomeIdx)) {
                viewRefAllele = r.alleleB
                break
              }
            }
          }
          // Default: VCF ref is allele 0
          if (viewRefAllele === undefined) {
            viewRefAllele = 0
          }

          if (queryAllele !== undefined && queryAllele !== viewRefAllele) {
            // Find the pairwise CS record between the view-ref allele and query allele
            const pairRecord = records.find(
              r =>
                (r.alleleA === viewRefAllele && r.alleleB === queryAllele) ||
                (r.alleleB === viewRefAllele && r.alleleA === queryAllele),
            )
            if (pairRecord) {
              csParts.push(pairRecord.cs)
              identityMatchBp += pairRecord.identity * locusLen
              identityTotalBp += locusLen
            } else {
              csParts.push(`:${locusLen}`)
              identityMatchBp += locusLen
              identityTotalBp += locusLen
            }
          } else {
            csParts.push(`:${locusLen}`)
            identityMatchBp += locusLen
            identityTotalBp += locusLen
          }
          pos = locus.end
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
    console.log(
      `[annotateFeaturesWithBubbleCs] ${bubbles.length} bubbles, ${matchedGenomes} matched genomes, ${unmatchedGenomes} unmatched genomes`,
      unmatchedGenomes > 0
        ? `(first unmatched: ${[...genomeRows.keys()].find(n => {
            const orig =
              Object.entries(nameMap).find(([, v]) => v === n)?.[0] ?? n
            return (
              genomeIdx.get(orig) === undefined &&
              genomeIdx.get(n) === undefined
            )
          })}, bubbles genomes: ${[...genomeIdx.keys()].slice(0, 3).join(',')}...)`
        : '',
    )
  }
}
