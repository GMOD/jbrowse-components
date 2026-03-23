import { BgzfFilehandle } from '@gmod/bgzf-filehandle'
import { TabixIndexedFile } from '@gmod/tabix'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

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
  pathName: string
  offset: number
  segLen: number
  orient: string
}

export interface SegmentsShard {
  bgzf: BgzfFilehandle
  idxFile: GenericFilehandle
  idxPromise?: Promise<BigUint64Array>
  pathNames?: string[]
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

const DECODE_CHUNK = 512 * 1024 * 1024

export function parseSegmentsBytes(bytes: Uint8Array, pathNames: string[]) {
  const decoder = new TextDecoder()
  const records: SegRecord[] = []
  let tail = ''

  const parseLine = (line: string) => {
    if (line.length === 0 || line.charCodeAt(0) === 35 /* '#' */) {
      return
    }
    const t1 = line.indexOf('\t')
    const t2 = line.indexOf('\t', t1 + 1)
    const t3 = line.indexOf('\t', t2 + 1)
    const t4 = line.indexOf('\t', t3 + 1)
    records.push({
      segOrd: +line.slice(0, t1),
      pathName: pathNames[+line.slice(t1 + 1, t2)] ?? line.slice(t1 + 1, t2),
      offset: +line.slice(t2 + 1, t3),
      segLen: +line.slice(t3 + 1, t4),
      orient: line[t4 + 1]!,
    })
  }

  for (let pos = 0; pos < bytes.length; pos += DECODE_CHUNK) {
    const isLast = pos + DECODE_CHUNK >= bytes.length
    const text =
      tail +
      decoder.decode(bytes.subarray(pos, pos + DECODE_CHUNK), {
        stream: !isLast,
      })
    const lines = text.split('\n')
    tail = lines.pop()!
    for (const line of lines) {
      parseLine(line)
    }
  }
  if (tail.length > 0) {
    parseLine(tail)
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
  ordinals: number[],
) {
  const idx = await loadSegmentsIndex(shard)
  const pathNames = shard.pathNames ?? []

  // Convert sorted ordinals directly into merged byte ranges. Since ordinals
  // are sorted and the idx is monotonically increasing, byte ranges arrive in
  // order and we can merge in a single pass without a separate sort step.
  const merged: { start: number; end: number }[] = []
  for (const ord of ordinals) {
    if (ord >= 0 && ord + 1 < idx.length) {
      const start = Number(idx[ord]!)
      const end = Number(idx[ord + 1]!)
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

  console.log(
    `getSegmentsForOrdinalsFromShard: ${ordinals.length} ordinals -> ${merged.length} merged ranges (idx.length=${idx.length}, ordinals=${JSON.stringify(ordinals.slice(0, 10))})`,
  )

  const allRecords: SegRecord[] = []
  const results = await Promise.all(
    merged.map(async range => {
      const length = range.end - range.start
      console.log(
        `  fetch bgzf bytes ${range.start}-${range.end} (${(length / 1024 / 1024).toFixed(2)} MB)`,
      )
      const t0 = performance.now()
      const bytes = await shard.bgzf.read(length, range.start)
      const t1 = performance.now()
      const records = parseSegmentsBytes(bytes, pathNames)
      const t2 = performance.now()
      console.log(
        `  bgzf.read ${(t1 - t0).toFixed(0)}ms, parse ${(t2 - t1).toFixed(0)}ms,` +
          ` decoded ${(bytes.length / 1024 / 1024).toFixed(2)} MB, ${records.length} records`,
      )
      return records
    }),
  )
  for (const records of results) {
    for (const r of records) {
      allRecords.push(r)
    }
  }
  return allRecords
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
    ordinals: number[],
    pathNames: string[],
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

    const pathNames = sizesMatch
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

  async getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: BaseOptions['stopToken'] } = {},
  ) {
    const { alnAvailable } = await this.setup()
    checkStopToken(opts.stopToken)
    const useAln = alnAvailable && (opts.bpPerPx ?? Infinity) < 10
    if (useAln) {
      return this.getMultiPairFeaturesFromAln(query, opts)
    }
    return this.getMultiPairFeaturesFromSegments(query, opts)
  }

  private async getMultiPairFeaturesFromAln(
    query: Region,
    opts: { stopToken?: StopToken } = {},
  ) {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const { refName, start, end, assemblyName } = query

    const { alnRefNames } = await this.setup()
    if (!alnRefNames) {
      return { genomeNames: [] as string[], genomeRows }
    }
    const tabixRefName = this.resolveTabixRefName(
      alnRefNames,
      assemblyName,
      refName,
    )
    if (!tabixRefName) {
      return { genomeNames: [] as string[], genomeRows }
    }

    await this.alnFile!.getLines(tabixRefName, start, end, {
      lineCallback: (line: string, fileOffset: number) => {
        checkStopToken(opts.stopToken)
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

    return { genomeNames: [...genomeRows.keys()], genomeRows }
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
      return { genomeNames: [] as string[], genomeRows }
    }

    const ordinalSet = new Set<number>()

    await this.posFile.getLines(refPathName, start, end, {
      lineCallback: (line: string) => {
        checkStopToken(opts.stopToken)
        // Find the 4th column (ordinal ranges) without allocating a split
        // array. Format: path\tstart\tend\t0-23,58-80,121
        // Each token is either a single ordinal or a start-end range.
        let t = 0
        for (let n = 0; n < 3; n++) {
          t = line.indexOf('\t', t) + 1
        }
        const idsStr = line.slice(t)
        let i = 0
        while (i < idsStr.length) {
          let j = idsStr.indexOf(',', i)
          if (j === -1) {
            j = idsStr.length
          }
          const token = idsStr.slice(i, j)
          const dash = token.indexOf('-')
          if (dash > 0) {
            const lo = +token.slice(0, dash)
            const hi = +token.slice(dash + 1)
            for (let o = lo; o <= hi; o++) {
              ordinalSet.add(o)
            }
          } else {
            ordinalSet.add(+token)
          }
          i = j + 1
        }
      },
    })

    if (ordinalSet.size === 0) {
      return { genomeNames: [] as string[], genomeRows }
    }

    checkStopToken(opts.stopToken)
    const ordinals = [...ordinalSet].sort((a, b) => a - b)
    const allSegs = await this.getSegsForOrdinals(ordinals, pathNames)
    const refSegments: SegRecord[] = []
    const otherSegments = new Map<string, SegRecord[]>()

    for (const rec of allSegs) {
      if (rec.pathName === refPathName) {
        refSegments.push(rec)
      } else {
        if (!otherSegments.has(rec.pathName)) {
          otherSegments.set(rec.pathName, [])
        }
        otherSegments.get(rec.pathName)!.push(rec)
      }
    }

    const refSegOrdSet = new Set(refSegments.map(s => s.segOrd))
    const refByOrd = new Map(refSegments.map(s => [s.segOrd, s]))

    for (const [otherPath, segments] of otherSegments) {
      const { genome: rawGenome, refName: mateRefName } =
        parseGfaPathName(otherPath)
      const genomeName = this.remapGenome(rawGenome)

      if (!genomeRows.has(genomeName)) {
        genomeRows.set(genomeName, [])
      }
      const features = genomeRows.get(genomeName)!

      const paired: { ref: SegRecord; query: SegRecord; strand: number }[] = []
      for (const seg of segments) {
        const refSeg = refSegOrdSet.has(seg.segOrd)
          ? refByOrd.get(seg.segOrd)
          : undefined
        if (refSeg) {
          paired.push({
            ref: refSeg,
            query: seg,
            strand: seg.orient === refSeg.orient ? 1 : -1,
          })
        }
      }
      if (paired.length === 0) {
        continue
      }
      paired.sort((a, b) => a.ref.offset - b.ref.offset)

      let ms = -1
      let me = -1
      let mms = -1
      let mme = -1
      let mStrand = 0
      let mOrd = -1
      let matchBp = 0
      let mismatchBp = 0
      let cigarParts: string[] = []
      let runMatchLen = 0

      const flushMatch = () => {
        if (runMatchLen > 0) {
          cigarParts.push(`${runMatchLen}=`)
          matchBp += runMatchLen
          runMatchLen = 0
        }
      }

      const emit = () => {
        flushMatch()
        if (ms >= 0) {
          const totalAligned = matchBp + mismatchBp
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
            identity: totalAligned > 0 ? matchBp / totalAligned : 1,
            featureId: `gfa-${mOrd}-${otherPath}`,
            segmentId: undefined,
            cigar: cigarParts.length > 1 ? cigarParts.join('') : undefined,
            cs: undefined,
          })
          cigarParts = []
          matchBp = 0
          mismatchBp = 0
          ms = -1
        }
      }

      for (let i = 0; i < paired.length; i++) {
        const p = paired[i]!
        const rs = p.ref.offset
        const re = p.ref.offset + p.ref.segLen
        const qs = p.query.offset
        const qe = p.query.offset + p.query.segLen

        if (ms < 0 || p.strand !== mStrand) {
          emit()
          ms = rs
          me = re
          mms = qs
          mme = qe
          mStrand = p.strand
          mOrd = p.ref.segOrd

          runMatchLen = p.ref.segLen
          continue
        }

        const refGap = rs - me
        const queryGap = mStrand === 1 ? qs - mme : mms - qe

        if (refGap < 0 || queryGap < 0) {
          emit()
          ms = rs
          me = re
          mms = qs
          mme = qe
          mOrd = p.ref.segOrd

          runMatchLen = p.ref.segLen
          continue
        }

        if (refGap > 0 || queryGap > 0) {
          flushMatch()
          if (refGap > 0 && queryGap > 0) {
            const overlap = Math.min(refGap, queryGap)
            cigarParts.push(`${overlap}X`)
            mismatchBp += overlap
            if (refGap > queryGap) {
              cigarParts.push(`${refGap - queryGap}D`)
            } else if (queryGap > refGap) {
              cigarParts.push(`${queryGap - refGap}I`)
            }
          } else if (refGap > 0) {
            cigarParts.push(`${refGap}D`)
          } else {
            cigarParts.push(`${queryGap}I`)
          }
        }

        runMatchLen += p.ref.segLen
        me = re
        if (mStrand === 1) {
          mme = qe
        } else {
          mms = qs
        }
      }
      emit()
    }

    return { genomeNames: [...genomeRows.keys()], genomeRows }
  }
}
