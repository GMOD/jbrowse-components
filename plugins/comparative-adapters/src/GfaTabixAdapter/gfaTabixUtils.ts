import { BgzfFilehandle } from '@gmod/bgzf-filehandle'
import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken,
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { csToCigar } from '../csUtils.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'
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
  bgzf: BgzfFilehandle
  idxFile: GenericFilehandle
  idxPromise?: Promise<BigUint64Array>
}

interface SetupResult {
  genomes: string[]
  chromSizes: Map<string, { refName: string; length: number }[]>
  posRefNames: Set<string>
  pathNames: string[]
  alnAvailable: boolean
  alnRefNames?: Set<string>
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

// Parse an integer directly from ASCII bytes, avoiding string allocation.
function parseIntBytes(buf: Uint8Array, start: number, end: number) {
  let n = 0
  for (let i = start; i < end; i++) {
    n = n * 10 + buf[i]! - 48
  }
  return n
}

const TAB = 9
const NEWLINE = 10
const HASH = 35

export function parseSegmentsBytes(bytes: Uint8Array) {
  const records: SegRecord[] = []
  const len = bytes.length
  let lineStart = 0

  while (lineStart < len) {
    let lineEnd = lineStart
    while (lineEnd < len && bytes[lineEnd] !== NEWLINE) {
      lineEnd++
    }

    if (lineEnd > lineStart && bytes[lineStart] !== HASH) {
      let t1 = lineStart
      while (t1 < lineEnd && bytes[t1] !== TAB) {
        t1++
      }
      let t2 = t1 + 1
      while (t2 < lineEnd && bytes[t2] !== TAB) {
        t2++
      }
      let t3 = t2 + 1
      while (t3 < lineEnd && bytes[t3] !== TAB) {
        t3++
      }
      let t4 = t3 + 1
      while (t4 < lineEnd && bytes[t4] !== TAB) {
        t4++
      }

      records.push({
        segOrd: parseIntBytes(bytes, lineStart, t1),
        pathNameIdx: parseIntBytes(bytes, t1 + 1, t2),
        offset: parseIntBytes(bytes, t2 + 1, t3),
        segLen: parseIntBytes(bytes, t3 + 1, t4),
        orient: bytes[t4 + 1]!,
      })
    }

    lineStart = lineEnd + 1
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


// Merge thresholds for combining nearby byte ranges into single bgzf reads
const MERGE_GAP = 65_000
const MAX_MERGED_BYTES = 20 * 1024 * 1024

export async function getSegmentsForOrdinalsFromShard(
  shard: SegmentsShard,
  ordinalRanges: [number, number][],
) {
  const idx = await loadSegmentsIndex(shard)

  // Convert sorted ordinal ranges directly into merged byte ranges.
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
      console.log(
        `  fetch bgzf bytes ${range.start}-${range.end} (${(length / 1024 / 1024).toFixed(2)} MB)`,
      )
      const t0 = performance.now()
      const bytes = await shard.bgzf.read(length, range.start)
      const t1 = performance.now()
      const records = parseSegmentsBytes(bytes)
      const t2 = performance.now()
      console.log(
        `  bgzf.read ${(t1 - t0).toFixed(0)}ms, parse ${(t2 - t1).toFixed(0)}ms,` +
          ` decoded ${(bytes.length / 1024 / 1024).toFixed(2)} MB, ${records.length} records`,
      )
      return records
    }),
  )
  return results.flat()
}

export abstract class BaseGfaTabixAdapter extends BaseFeatureDataAdapter {
  public static capabilities = ['getFeatures', 'getRefNames']

  protected posFile: TabixIndexedFile
  protected alnFile?: TabixIndexedFile
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

    const alnLoc = this.getConf('alnLocation') as FileLocation | undefined
    const hasAlnLoc =
      alnLoc &&
      (('uri' in alnLoc && alnLoc.uri !== '') ||
        ('localPath' in alnLoc && alnLoc.localPath !== ''))
    if (hasAlnLoc) {
      const alnIdxLoc = this.getConf(['alnIndex', 'location']) as FileLocation
      this.alnFile = new TabixIndexedFile({
        filehandle: openLocation(alnLoc, pm),
        tbiFilehandle: openLocation(alnIdxLoc, pm),
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

    const chromSizes = new Map<
      string,
      { refName: string; length: number }[]
    >()
    const sizesMatch = /sizes=([^\n]+)/.exec(header)
    if (!sizesMatch) {
      console.warn(
        '[GfaTabixAdapter] pos.bed.gz header missing #sizes= line — auto-assembly creation will not work',
      )
    }
    if (sizesMatch) {
      for (const entry of sizesMatch[1]!.split(',')) {
        const colonIdx = entry.lastIndexOf(':')
        if (colonIdx < 0) {
          continue
        }
        const { genome, refName } = parseGfaPathName(
          entry.slice(0, colonIdx),
        )
        const length = +entry.slice(colonIdx + 1)
        if (!chromSizes.has(genome)) {
          chromSizes.set(genome, [])
        }
        chromSizes.get(genome)!.push({ refName, length })
      }
    }

    const posRefNames = new Set(
      await this.posFile.getReferenceSequenceNames(),
    )

    let alnAvailable = false
    let alnRefNames: Set<string> | undefined
    if (this.alnFile) {
      try {
        await this.alnFile.getHeader()
        alnRefNames = new Set(
          await this.alnFile.getReferenceSequenceNames(),
        )
        alnAvailable = true
      } catch {
        // aln file not available
      }
    }

    const pathsMatch = /paths=([^\n]+)/.exec(header)
    const pathNames = pathsMatch
      ? pathsMatch[1]!.split(',')
      : sizesMatch
        ? sizesMatch[1]!.split(',').map(entry => {
            const colonIdx = entry.lastIndexOf(':')
            return colonIdx >= 0 ? entry.slice(0, colonIdx) : entry
          })
        : []

    return {
      genomes,
      chromSizes,
      posRefNames,
      pathNames,
      alnAvailable,
      alnRefNames,
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
    const { alnAvailable } = await this.setup()
    checkStopToken(opts.stopToken)
    const genomeRows = alnAvailable
      ? await this.getMultiPairFeaturesFromAln(query, opts)
      : await this.getMultiPairFeaturesFromSegments(query, opts)

    return { genomeRows }
  }

  private async getMultiPairFeaturesFromAln(
    query: Region,
    opts: { stopToken?: StopToken } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const { refName, start, end, assemblyName } = query

    const { alnRefNames } = await this.setup()
    if (!alnRefNames) {
      return genomeRows
    }
    const tabixRefName = this.resolveTabixRefName(
      alnRefNames,
      assemblyName,
      refName,
    )
    if (!tabixRefName) {
      return genomeRows
    }

    const alnChecker = createStopTokenChecker(opts.stopToken)
    await this.alnFile!.getLines(tabixRefName, start, end, {
      lineCallback: (line: string, fileOffset: number) => {
        checkStopToken2(alnChecker)
        const cols = line.split('\t')
        const queryGenome = this.remapGenome(cols[3]!)
        const mateRefName = cols[4]!
        const mateStart = +cols[5]!
        const mateEnd = +cols[6]!
        const strand = cols[7] === '-' ? -1 : 1
        const cs = cols[8] ?? ''
        const cigar = csToCigar(cs)

        const refStart = +cols[1]!
        const refEnd = +cols[2]!

        let matchBp = 0
        let mismatchBp = 0
        let i = 0
        while (i < cs.length) {
          const ch = cs[i]!
          if (ch === ':') {
            i++
            let num = ''
            while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
              num += cs[i]
              i++
            }
            matchBp += +num
          } else if (ch === '*') {
            mismatchBp++
            i += 3
          } else if (ch === '+' || ch === '-') {
            i++
            while (
              i < cs.length &&
              cs[i] !== ':' &&
              cs[i] !== '*' &&
              cs[i] !== '+' &&
              cs[i] !== '-'
            ) {
              i++
            }
          } else {
            i++
          }
        }
        const totalAligned = matchBp + mismatchBp
        const identity = totalAligned > 0 ? matchBp / totalAligned : 1

        if (!genomeRows.has(queryGenome)) {
          genomeRows.set(queryGenome, [])
        }
        genomeRows.get(queryGenome)!.push({
          queryGenome,
          origRefName: refName,
          start: refStart,
          end: refEnd,
          mateStart,
          mateEnd,
          mateRefName,
          strand,
          syriType: undefined,
          identity,
          featureId: `aln-${fileOffset}`,
          segmentId: undefined,
          cigar,
          cs,
        })
      },
    })

    return genomeRows
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
        // Format: path\tstart\tend\tstartOrd\tendOrd
        let t = 0
        for (let n = 0; n < 3; n++) {
          t = line.indexOf('\t', t) + 1
        }
        const t5 = line.indexOf('\t', t)
        const col4 = line.slice(t, t5 >= 0 ? t5 : undefined)

        if (t5 >= 0) {
          // New two-column format: startOrd\tendOrd
          rawRanges.push([+col4, +line.slice(t5 + 1)])
        } else if (col4.includes('-') || col4.includes(',')) {
          // Old sparse format: 0-6,10,15-20
          let i = 0
          while (i < col4.length) {
            let j = col4.indexOf(',', i)
            if (j === -1) {
              j = col4.length
            }
            const token = col4.slice(i, j)
            const dash = token.indexOf('-')
            if (dash > 0) {
              rawRanges.push([+token.slice(0, dash), +token.slice(dash + 1)])
            } else {
              rawRanges.push([+token, +token])
            }
            i = j + 1
          }
        } else {
          rawRanges.push([+col4, +col4])
        }
      },
    })

    if (rawRanges.length === 0) {
      return genomeRows
    }

    // Sort by lo ordinal, then merge overlapping/adjacent ranges
    rawRanges.sort((a, b) => a[0] - b[0])
    const ordinalRanges: [number, number][] = []
    for (const [lo, hi] of rawRanges) {
      const prev = ordinalRanges.length > 0 ? ordinalRanges[ordinalRanges.length - 1]! : undefined
      if (prev && lo <= prev[1] + 1) {
        prev[1] = Math.max(prev[1], hi)
      } else {
        ordinalRanges.push([lo, hi])
      }
    }

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
        sample.map(s => `ord=${s.segOrd} pathIdx=${s.pathNameIdx} off=${s.offset} len=${s.segLen}`),
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
    for (const features of genomeRows.values()) {
      for (const f of features) {
        if (f.strand === -1) {
          revCount++
        } else {
          fwdCount++
        }
      }
    }
    console.log(`[getMultiPairFeaturesFromSegments] strand distribution: fwd=${fwdCount} rev=${revCount} (${(revCount / (fwdCount + revCount) * 100).toFixed(1)}% inversions)`)

    return genomeRows
  }
}
