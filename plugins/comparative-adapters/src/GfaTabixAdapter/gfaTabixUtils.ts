import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import {
  checkStopToken,
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import {
  loadAlnIndex,
  queryAlnBin,
} from '../binaryAlnReader.ts'
import { decodeBinaryCs } from '../binaryCs.ts'
import SyntenyFeature from '../SyntenyFeature/index.ts'

import type { AlnIndex } from '../binaryAlnReader.ts'
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
  filehandle: GenericFilehandle
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
  alnBinAvailable: boolean
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
  const col4 = line.slice(t, t5 >= 0 ? t5 : undefined)

  if (t5 >= 0) {
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
  protected alnFile?: TabixIndexedFile
  protected alnBinFile?: GenericFilehandle
  protected alnBinIdxFile?: GenericFilehandle
  private alnIndexP?: Promise<AlnIndex>
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

    const alnBinLoc = this.getConf('alnBinLocation') as
      | FileLocation
      | undefined
    const hasAlnBinLoc =
      alnBinLoc &&
      (('uri' in alnBinLoc && alnBinLoc.uri !== '') ||
        ('localPath' in alnBinLoc && alnBinLoc.localPath !== ''))
    if (hasAlnBinLoc) {
      this.alnBinFile = openLocation(alnBinLoc, pm)
      const alnBinIdxLoc = this.getConf('alnBinIdxLocation') as FileLocation
      this.alnBinIdxFile = openLocation(alnBinIdxLoc, pm)
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

    let alnBinAvailable = false
    if (this.alnBinIdxFile) {
      try {
        const idx = await this.loadAlnBinIndex()
        if (idx.genomeNames.length > 0) {
          alnBinAvailable = true
        }
      } catch {
        // binary aln not available
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
      alnBinAvailable,
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

  private async loadAlnBinIndex() {
    if (!this.alnIndexP) {
      this.alnIndexP = loadAlnIndex(this.alnBinIdxFile!)
    }
    return this.alnIndexP
  }

  async getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: BaseOptions['stopToken'] } = {},
  ) {
    const { alnAvailable, alnBinAvailable } = await this.setup()
    checkStopToken(opts.stopToken)
    console.log(
      '[getMultiPairFeatures] dispatch:',
      'alnBinAvailable:', alnBinAvailable,
      'alnAvailable:', alnAvailable,
      'query:', `${query.assemblyName}/${query.refName}:${query.start}-${query.end}`,
    )
    let genomeRows: Map<string, MultiPairFeature[]>
    if (alnBinAvailable) {
      genomeRows = await this.getMultiPairFeaturesFromAlnBin(query, opts)
      if (genomeRows.size === 0) {
        console.warn(
          '[getMultiPairFeatures] WARNING: alnBin returned 0 genomes for',
          `${query.assemblyName}/${query.refName}:${query.start}-${query.end}`,
          '— the aln.bin may have been generated from a GFA without segment sequences (non-d9 graph)',
        )
      }
    } else if (alnAvailable) {
      genomeRows = await this.getMultiPairFeaturesFromAln(query, opts)
    } else {
      genomeRows = await this.getMultiPairFeaturesFromSegments(query, opts)
    }

    return { genomeRows }
  }

  async getSubgraph(
    region: Region,
    opts: { stopToken?: StopToken } = {},
  ) {
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
          cigar: undefined,
          cs,
        })
      },
    })

    return genomeRows
  }

  private async getMultiPairFeaturesFromAlnBin(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const { refName, start, end, assemblyName } = query

    const alnIndex = await this.loadAlnBinIndex()

    // Resolve the chrom name in the binary index
    const qualified = `${assemblyName}#${refName}`
    let chromName: string | undefined
    if (alnIndex.chromNames.includes(qualified)) {
      chromName = qualified
    } else if (alnIndex.chromNames.includes(refName)) {
      chromName = refName
    } else {
      // Try partial match — the aln.bed.gz format uses full path names
      // like "assembly#hap#chr" as chrom names
      chromName = alnIndex.chromNames.find(
        n => n.endsWith(`#${refName}`) || n === refName,
      )
    }
    console.log(
      '[getMultiPairFeaturesFromAlnBin] chromName resolution:',
      'refName:', refName,
      'assemblyName:', assemblyName,
      'qualified:', qualified,
      'resolved:', chromName,
      'available chromNames:', alnIndex.chromNames.slice(0, 10),
      '(total:', alnIndex.chromNames.length + ')',
    )
    if (!chromName) {
      console.log('[getMultiPairFeaturesFromAlnBin] No matching chromName found, returning empty')
      return genomeRows
    }

    checkStopToken(opts.stopToken)
    const records = await queryAlnBin(
      this.alnBinFile!,
      alnIndex,
      chromName,
      start,
      end,
    )
    console.log(
      '[getMultiPairFeaturesFromAlnBin] queryAlnBin returned',
      records.length,
      'records for',
      chromName,
      start,
      '-',
      end,
    )

    // At zoomed-out views (bpPerPx > 50), skip expensive CIGAR/CS decoding
    const decodeCigar = !opts.bpPerPx || opts.bpPerPx < 50

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]!
      const genomeName = this.remapGenome(
        alnIndex.genomeNames[rec.queryGenomeIdx] ??
          `genome-${rec.queryGenomeIdx}`,
      )
      const mateRefName =
        alnIndex.chromNames[rec.mateChromIdx] ??
        `chrom-${rec.mateChromIdx}`

      // Parse the mate ref name to extract just the refName part
      const { refName: parsedMateRefName } =
        parseGfaPathName(mateRefName)

      if (!genomeRows.has(genomeName)) {
        genomeRows.set(genomeName, [])
      }

      let cs: string | undefined
      if (decodeCigar && rec.csData.length > 0) {
        cs = decodeBinaryCs(rec.csData)
      }

      genomeRows.get(genomeName)!.push({
        queryGenome: genomeName,
        origRefName: refName,
        start: rec.refStart,
        end: rec.refEnd,
        mateStart: rec.mateStart,
        mateEnd: rec.mateEnd,
        mateRefName: parsedMateRefName,
        strand: rec.strand,
        syriType: undefined,
        identity: rec.identity,
        featureId: `aln-bin-${i}`,
        segmentId: undefined,
        cigar: undefined,
        cs,
      })
    }

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


    // Debug: analyze ref segment coverage to see if there's a gap in ref itself
    {
      const sortedRef = [...refSegments].sort((a, b) => a.offset - b.offset)
      let prevEnd = 0
      const gaps: string[] = []
      for (const seg of sortedRef) {
        if (seg.offset > prevEnd + 100) {
          gaps.push(`${(prevEnd / 1e6).toFixed(3)}-${(seg.offset / 1e6).toFixed(3)}Mb (${((seg.offset - prevEnd) / 1000).toFixed(1)}kb)`)
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
    console.log(`[getMultiPairFeaturesFromSegments] strand distribution: fwd=${fwdCount} rev=${revCount} (${(revCount / (fwdCount + revCount) * 100).toFixed(1)}% inversions)`)
    console.log(
      `[getMultiPairFeaturesFromSegments] feature bp coverage: ${globalMinBp.toLocaleString()}-${globalMaxBp.toLocaleString()}`,
      `query range: ${refName}:${start.toLocaleString()}-${end.toLocaleString()}`,
      `features cover ${((globalMaxBp - globalMinBp) / (end - start) * 100).toFixed(1)}% of query`,
      `total features: ${totalFeatures} across ${genomeRows.size} genomes`,
    )

    // Log per-genome coverage to spot if some genomes have features only in part of range
    const coverageSummary: string[] = []
    for (const [genomeName, features] of genomeRows) {
      if (features.length > 0) {
        const gMin = Math.min(...features.map(f => f.start))
        const gMax = Math.max(...features.map(f => f.end))
        coverageSummary.push(`${genomeName}: ${features.length} feats ${(gMin / 1e6).toFixed(2)}-${(gMax / 1e6).toFixed(2)}Mb`)
      }
    }
    if (coverageSummary.length <= 10) {
      console.log(`[getMultiPairFeaturesFromSegments] per-genome:`, coverageSummary)
    } else {
      console.log(`[getMultiPairFeaturesFromSegments] first 5 genomes:`, coverageSummary.slice(0, 5))
    }

    return genomeRows
  }
}
