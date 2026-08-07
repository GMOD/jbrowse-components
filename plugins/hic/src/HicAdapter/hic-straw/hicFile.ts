// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw
//
// The original supported url/blob/local-path inputs and bundled its own
// zlib. This port accepts only a JBrowse filehandle and uses pako-esm2 for
// inflate; the remote IO layer, the legacy normalization-vector-index lookup
// table, and the FRAG-site code paths were dropped.

import { inflate } from 'pako-esm2'

import { binWindow } from './binWindow.ts'
import BinaryParser from './binary.ts'
import BufferedFile from './bufferedFile.ts'
import LRU from './lru.ts'
import Matrix from './matrix.ts'
import NormalizationVector from './normalizationVector.ts'

import type { ContactRecords } from './contactRecords.ts'
import type MatrixZoomData from './matrixZoomData.ts'
import type {
  BlockIndexEntry,
  Chromosome,
  Filehandle,
  HicMetadata,
  HicRegion,
} from './types.ts'

/**
 * Prefix of the error thrown when a region pair has no matrix at the requested
 * binsize. `HicAdapter.fetchRegionPairRecords` drops that pair rather than
 * failing a whole multi-region fetch, and it can only tell this apart from a
 * real failure by the message — so the two share this constant instead of
 * matching a hand-copied string.
 */
export const NO_DATA_FOR_RESOLUTION = 'No data available for resolution'

const Short_MIN_VALUE = -32768
const DOUBLE = 8
const FLOAT = 4
const INT = 4

interface MasterIndexEntry {
  start: number
  size: number
}

export interface HicConfig {
  file: Filehandle
  nvi?: string
}

// Cached blocks are the decompressed records and nothing else. hic-straw also
// hung the MatrixZoomData and the block-index entry off each Block; neither was
// ever read back, and the zoom data pinned a whole `blockIndex` record per
// cached block for the lifetime of the LRU.
interface Block {
  blockNumber: number
  records: ContactRecords
}

/**
 * Copy a partially-filled decode buffer down to its true length, or hand it
 * back untouched when the filter dropped nothing. A `subarray` would be free
 * but keeps the whole oversized buffer reachable, and these land in a cache
 * that outlives the fetch.
 */
function truncateRecords(records: ContactRecords, n: number): ContactRecords {
  return n === records.bin1.length
    ? records
    : {
        bin1: records.bin1.slice(0, n),
        bin2: records.bin2.slice(0, n),
        counts: records.counts.slice(0, n),
      }
}

// Keyed by `${zd.getKey()}_${blockNumber}`, which already carries the binsize,
// so no separate resolution generation is needed to keep entries apart —
// hic-straw's extra `resolution` field only made the cache single-resolution
// (every zoom step threw the previous level away).
//
// Sized for a multi-region fetch's working set rather than a single region's.
// At the auto binsize a view is a few hundred bins wide, so one region pair is
// 1-4 blocks; three displayed regions is six pairs, which at the top of that
// range is 24 blocks — so the previous cap of 16 could still evict a fetch's
// own earlier reads before it finished, the exact thrash that raising it from 6
// was meant to stop.
//
// Room to fix that came from blocks becoming struct-of-arrays (see
// contactRecords.ts): a cached contact went from ~55 bytes on the GC-traced
// heap to 12 bytes of untraced ArrayBuffer, so 48 entries now costs less memory
// than 16 did before — and costs the garbage collector nothing at all, which is
// what actually capped this. Still deliberately bounded: a block holds every
// contact in its bin square, so this remains the one thing here that can hold
// real memory.
const BLOCK_CACHE_SIZE = 48

function getNormalizationVectorKey(
  type: string,
  chrIdx: number,
  unit: string,
  resolution: number,
) {
  return `${type}_${chrIdx}_${unit}_${resolution}`
}

export default class HicFile {
  private config: HicConfig
  private file: Filehandle

  private normVectorCache = new LRU<string, NormalizationVector>(10)
  private normalizationTypes = ['NONE']
  private matrixCache = new LRU<string, Matrix | undefined>(10)
  private blockCache = new LRU<string, Block>(BLOCK_CACHE_SIZE)
  private normVectorIndexPosition = -1
  private normVectorIndexSize = -1

  private initPromise: Promise<void> | undefined
  private normVectorIndexP: Promise<void> | undefined
  private version = 0
  private genomeId = ''
  private footerPosition = 0
  private normExpectedValueVectorsPosition: number | undefined
  private normVectorIndex: Record<string, BlockIndexEntry> | undefined

  private chromosomes: Chromosome[] = []
  private chromosomeIndexMap: Record<string, number> = {}
  private chrAliasTable: Record<string, string> = {}
  private bpResolutions: number[] = []
  private masterIndex: Record<string, MasterIndexEntry> = {}
  private meta: HicMetadata | undefined

  constructor(config: HicConfig) {
    this.config = config
    this.file = config.file
  }

  async init() {
    // Memoize the promise, not a boolean flag: two concurrent callers must
    // share one header parse rather than both racing readHeaderAndFooter. Clear
    // it on failure (like BamAdapter's setupOnce) so a later call retries
    // instead of caching a rejected promise forever.
    this.initPromise ??= this.readHeaderAndFooter().catch((e: unknown) => {
      this.initPromise = undefined
      throw e
    })
    return this.initPromise
  }

  async getMetaData() {
    await this.init()
    return this.meta!
  }

  async readHeaderAndFooter() {
    // `init` clears its memoized promise on failure so a transient read error
    // retries, and this parse appends as it goes — so a retry has to start from
    // empty or a failure part-way through the chromosome loop leaves the second
    // run appending to the first's partial output (duplicate refNames out of
    // `getRefNames`, a duplicated binsize list out of `getMetaData`).
    this.chromosomes = []
    this.chromosomeIndexMap = {}
    this.chrAliasTable = {}
    this.bpResolutions = []
    this.masterIndex = {}

    // Read initial fields magic, version, and footer position
    let data = await this.file.read(0, 16)
    if (data.byteLength === 0) {
      throw new Error('File content is empty')
    }
    let binaryParser = new BinaryParser(new DataView(data))
    binaryParser.getString() // magic
    this.version = binaryParser.getInt()
    if (this.version < 5) {
      throw new Error(`Unsupported hic version: ${this.version}`)
    }
    this.footerPosition = binaryParser.getLong()

    // Read footer to determine file position of body section (end of header)
    await this.readFooter()

    const bodyPosition = Object.values(this.masterIndex).reduce(
      (min, entry) => Math.min(min, entry.start),
      Number.MAX_VALUE,
    )

    data = await this.file.read(16, bodyPosition - 16)
    binaryParser = new BinaryParser(new DataView(data))

    this.genomeId = binaryParser.getString()

    if (this.version >= 9) {
      this.normVectorIndexPosition = binaryParser.getLong()
      this.normVectorIndexSize = binaryParser.getLong()
    }

    let nAttributes = binaryParser.getInt()
    while (nAttributes-- > 0) {
      binaryParser.getString() // attribute key
      binaryParser.getString() // attribute value
    }

    let nChrs = binaryParser.getInt()
    let i = 0
    while (nChrs-- > 0) {
      const chr = {
        index: i,
        name: binaryParser.getString(),
        size: this.version < 9 ? binaryParser.getInt() : binaryParser.getLong(),
      }
      this.chromosomes.push(chr)
      this.chromosomeIndexMap[chr.name] = chr.index
      i++
    }

    let nBpResolutions = binaryParser.getInt()
    while (nBpResolutions-- > 0) {
      this.bpResolutions.push(binaryParser.getInt())
    }

    // Build lookup table for well-known chr aliases
    for (const chrName of Object.keys(this.chromosomeIndexMap)) {
      if (chrName.startsWith('chr')) {
        this.chrAliasTable[chrName.slice(3)] = chrName
      } else if (chrName === 'MT') {
        this.chrAliasTable.chrM = chrName
      } else {
        this.chrAliasTable[`chr${chrName}`] = chrName
      }
    }

    this.meta = {
      version: this.version,
      genome: this.genomeId,
      chromosomes: this.chromosomes,
      resolutions: this.bpResolutions,
    }
  }

  async readFooter() {
    const skip = this.version < 9 ? 8 : 12
    let data = await this.file.read(this.footerPosition, skip)

    let binaryParser = new BinaryParser(new DataView(data))
    // Total size, master index + expected values
    const nBytes =
      this.version < 9 ? binaryParser.getInt() : binaryParser.getLong()
    let nEntries = binaryParser.getInt()

    // Estimate the size of the master index. String key length is unknown, be
    // conservative (100 bytes).
    const miSize = nEntries * (100 + 64 + 32)
    data = await this.file.read(
      this.footerPosition + skip,
      Math.min(miSize, nBytes),
    )
    binaryParser = new BinaryParser(new DataView(data))

    while (nEntries-- > 0) {
      const key = binaryParser.getString()
      const pos = binaryParser.getLong()
      const size = binaryParser.getInt()
      this.masterIndex[key] = { start: pos, size }
    }

    // Normalized expected values start after the expected values
    if (this.version > 5) {
      const s = this.version < 9 ? 4 : 8
      this.normExpectedValueVectorsPosition = this.footerPosition + s + nBytes
    }
  }

  async getMatrix(chrIdx1: number, chrIdx2: number) {
    const key = Matrix.getKey(chrIdx1, chrIdx2)
    if (this.matrixCache.has(key)) {
      return this.matrixCache.get(key)
    } else {
      const matrix = await this.readMatrix(chrIdx1, chrIdx2)
      this.matrixCache.set(key, matrix)
      return matrix
    }
  }

  async readMatrix(chrIdx1: number, chrIdx2: number) {
    await this.init()

    const idx = this.masterIndex[Matrix.getKey(chrIdx1, chrIdx2)]
    let matrix: Matrix | undefined
    if (idx) {
      const data = await this.file.read(idx.start, idx.size)
      matrix = Matrix.parseMatrix(data, this.chromosomes)
    }
    return matrix
  }

  async getContactRecords(
    normalization: string,
    region1: HicRegion,
    region2: HicRegion,
    units: string,
    binsize: number,
  ) {
    await this.init()

    const idx1 = this.chromosomeIndexMap[this.getFileChrName(region1.chr)]
    const idx2 = this.chromosomeIndexMap[this.getFileChrName(region2.chr)]

    const transpose =
      idx1 !== undefined &&
      idx2 !== undefined &&
      (idx1 > idx2 || (idx1 === idx2 && region1.start >= region2.end))
    const r1 = transpose ? region2 : region1
    const r2 = transpose ? region1 : region2

    const [x1, x2] = binWindow(r1, binsize)
    const [y1, y2] = binWindow(r2, binsize)

    // Normalization vectors are loop-invariant across blocks, so resolve them
    // once up front. Each is paired with the bin offset its values start at.
    const norm = await this.getNormVectors(
      normalization,
      r1,
      r2,
      units,
      binsize,
    )

    const blocks = await this.getBlocks(r1, r2, binsize)

    // Sum of the blocks' record counts bounds the survivors, so the output is
    // allocated once and filled by a write cursor. Blocks overlap the window
    // rather than nest in it, so the true count isn't known without either this
    // upper bound or a counting pre-pass over the same data.
    let capacity = 0
    for (const block of blocks) {
      if (block) {
        capacity += block.records.bin1.length
      }
    }
    const outBin1 = new Int32Array(capacity)
    const outBin2 = new Int32Array(capacity)
    const outCounts = new Float32Array(capacity)
    let n = 0

    for (const block of blocks) {
      // An undefined block is most likely a base-pair range outside the
      // chromosome
      if (!block) {
        continue
      }
      const { bin1, bin2, counts } = block.records
      const len = bin1.length
      // `norm` is loop-invariant, so it selects the loop rather than being
      // retested per record — which also hoists the vector/offset reads
      if (norm) {
        const { v1, v2, offset1, offset2 } = norm
        for (let i = 0; i < len; i++) {
          const b1 = bin1[i]!
          const b2 = bin2[i]!
          if (b1 >= x1 && b1 < x2 && b2 >= y1 && b2 < y2) {
            const nvnv = v1[b1 - offset1]! * v2[b2 - offset2]!
            if (nvnv !== 0 && !Number.isNaN(nvnv)) {
              outBin1[n] = b1
              outBin2[n] = b2
              outCounts[n] = counts[i]! / nvnv
              n++
            }
          }
        }
      } else {
        for (let i = 0; i < len; i++) {
          const b1 = bin1[i]!
          const b2 = bin2[i]!
          if (b1 >= x1 && b1 < x2 && b2 >= y1 && b2 < y2) {
            outBin1[n] = b1
            outBin2[n] = b2
            outCounts[n] = counts[i]!
            n++
          }
        }
      }
    }

    // Views, not copies: this result is consumed immediately by the adapter's
    // concatenation, which copies into its own exactly-sized arrays.
    const contactRecords: ContactRecords = {
      bin1: outBin1.subarray(0, n),
      bin2: outBin2.subarray(0, n),
      counts: outCounts.subarray(0, n),
    }

    // What was actually applied, which is not always what was asked for:
    // normalization vectors are stored per (type, chr, unit, binsize), so a file
    // can offer KR at 5kb and nothing at 2.5Mb. hic-straw's answer was to warn to
    // the console and silently hand back raw counts; reporting it lets the
    // display tell the user which scheme they're looking at.
    //
    // `transposed` says the query was swapped, so `bin1` runs along `region2`.
    // Reported rather than left for the caller to re-derive: it is decided here
    // from this file's own alias table and chromosome indices, and a caller
    // re-deriving it off a divergent chr-name scheme would silently un-swap the
    // wrong axis.
    return {
      records: contactRecords,
      appliedNormalization: norm ? normalization : 'NONE',
      transposed: transpose,
    }
  }

  private async getNormVectors(
    normalization: string,
    r1: HicRegion,
    r2: HicRegion,
    units: string,
    binsize: number,
  ) {
    let result:
      | {
          v1: Float64Array
          v2: Float64Array
          offset1: number
          offset2: number
        }
      | undefined
    if (normalization && normalization !== 'NONE') {
      const chr1 = this.getFileChrName(r1.chr)
      const chr2 = this.getFileChrName(r2.chr)
      const offset1 = Math.floor(r1.start / binsize)
      const offset2 = Math.floor(r2.start / binsize)
      const nv1 = await this.getNormalizationVector(
        normalization,
        chr1,
        units,
        binsize,
      )
      const nv2 =
        chr1 === chr2
          ? nv1
          : await this.getNormalizationVector(
              normalization,
              chr2,
              units,
              binsize,
            )
      if (nv1 && nv2) {
        result = {
          v1: await nv1.getValues(offset1, Math.ceil(r1.end / binsize)),
          v2: await nv2.getValues(offset2, Math.ceil(r2.end / binsize)),
          offset1,
          offset2,
        }
      }
    }
    return result
  }

  async getBlocks(region1: HicRegion, region2: HicRegion, binSize: number) {
    const blockKey = (blockNumber: number, zd: MatrixZoomData) =>
      `${zd.getKey()}_${blockNumber}`

    await this.init()
    const chr1 = this.getFileChrName(region1.chr)
    const chr2 = this.getFileChrName(region2.chr)
    const idx1 = this.chromosomeIndexMap[chr1]
    const idx2 = this.chromosomeIndexMap[chr2]

    let blocks: (Block | undefined)[] = []
    if (idx1 === undefined) {
      console.warn(`No chromosome named: ${region1.chr}`)
    } else if (idx2 === undefined) {
      console.warn(`No chromosome named: ${region2.chr}`)
    } else {
      // A chr pair with no matrix at all is routine, not an anomaly: plenty of
      // .hic files store no inter-chromosomal maps, and a multi-region view asks
      // for every pair. Answering with no blocks (rather than warning once per
      // pair per fetch) matches how the adapter already treats a pair missing
      // this resolution.
      const matrix = await this.getMatrix(idx1, idx2)
      if (matrix) {
        const zd = matrix.getZoomData(binSize)
        if (!zd) {
          throw new Error(
            `${NO_DATA_FOR_RESOLUTION}: ${binSize} for map ${region1.chr}-${region2.chr}`,
          )
        }

        const blockNumbers = zd.getBlockNumbers(region1, region2, this.version)
        const blockNumbersToQuery: number[] = []
        for (const num of blockNumbers) {
          const cached = this.blockCache.get(blockKey(num, zd))
          if (cached) {
            blocks.push(cached)
          } else {
            blockNumbersToQuery.push(num)
          }
        }

        const newBlocks = await Promise.all(
          blockNumbersToQuery.map(blockNumber =>
            this.readBlock(blockNumber, zd),
          ),
        )
        for (const block of newBlocks) {
          if (block) {
            this.blockCache.set(blockKey(block.blockNumber, zd), block)
          }
        }
        blocks = blocks.concat(newBlocks)
      }
    }
    return blocks
  }

  async readBlock(blockNumber: number, zd: MatrixZoomData) {
    const idx = zd.blockIndex[blockNumber]

    let block: Block | undefined
    if (idx) {
      const data = await this.file.read(idx.filePosition, idx.size)
      const plain: Uint8Array = inflate(new Uint8Array(data), {})
      const parser = new BinaryParser(
        new DataView(plain.buffer, plain.byteOffset, plain.byteLength),
      )
      // Total records in the block, whatever encoding follows — so every branch
      // below knows its exact (or, for the dense encoding, upper-bound) size
      // before it starts reading and never has to grow an array.
      const nRecords = parser.getInt()
      block = { blockNumber, records: this.parseBlockRecords(parser, nRecords) }
    }
    return block
  }

  /**
   * Decode one block's records straight into typed arrays.
   *
   * Every encoding here knows its length up front, so each array is allocated
   * once and filled by a write cursor. Where a filter can drop records (the
   * dense encoding's empty cells) the arrays are sized to the upper bound and
   * copied down to the true length at the end — blocks are cached for the life
   * of the session, so it is worth one memcpy not to pin an oversized buffer.
   */
  private parseBlockRecords(
    parser: BinaryParser,
    nRecords: number,
  ): ContactRecords {
    if (this.version < 7) {
      const bin1 = new Int32Array(nRecords)
      const bin2 = new Int32Array(nRecords)
      const counts = new Float32Array(nRecords)
      for (let i = 0; i < nRecords; i++) {
        bin1[i] = parser.getInt()
        bin2[i] = parser.getInt()
        counts[i] = parser.getFloat()
      }
      return { bin1, bin2, counts }
    }

    const binXOffset = parser.getInt()
    const binYOffset = parser.getInt()

    const useFloatContact = parser.getByte() === 1
    const useIntXPos = this.version < 9 ? false : parser.getByte() === 1
    const useIntYPos = this.version < 9 ? false : parser.getByte() === 1
    const type = parser.getByte()

    if (type === 1) {
      // List-of-rows representation. The rows partition the block's records, so
      // `nRecords` sizes the arrays exactly; the overflow check is a
      // corrupt-file guard, not a growth path.
      const bin1 = new Int32Array(nRecords)
      const bin2 = new Int32Array(nRecords)
      const counts = new Float32Array(nRecords)
      let n = 0
      const rowCount = useIntYPos ? parser.getInt() : parser.getShort()
      for (let i = 0; i < rowCount; i++) {
        const dy = useIntYPos ? parser.getInt() : parser.getShort()
        const binY = binYOffset + dy
        const colCount = useIntXPos ? parser.getInt() : parser.getShort()
        if (n + colCount > nRecords) {
          throw new Error(
            `hic block declares ${nRecords} records but its rows hold more`,
          )
        }
        for (let j = 0; j < colCount; j++) {
          bin1[n] =
            binXOffset + (useIntXPos ? parser.getInt() : parser.getShort())
          bin2[n] = binY
          counts[n] = useFloatContact ? parser.getFloat() : parser.getShort()
          n++
        }
      }
      return truncateRecords({ bin1, bin2, counts }, n)
    }

    if (type === 2) {
      // Dense representation: `nPts` counts every cell of the w-wide rectangle,
      // empty ones included, so it is an upper bound on the surviving records.
      const nPts = parser.getInt()
      const w = parser.getShort()
      const bin1 = new Int32Array(nPts)
      const bin2 = new Int32Array(nPts)
      const counts = new Float32Array(nPts)
      let n = 0
      for (let i = 0; i < nPts; i++) {
        // read unconditionally: the parser advances a fixed stride per cell
        // whether or not the cell holds a value
        const c = useFloatContact ? parser.getFloat() : parser.getShort()
        // NaN (float) and Short_MIN_VALUE (int) are the "no value" markers
        if (useFloatContact ? !Number.isNaN(c) : c !== Short_MIN_VALUE) {
          const row = Math.floor(i / w)
          bin1[n] = binXOffset + (i - row * w)
          bin2[n] = binYOffset + row
          counts[n] = c
          n++
        }
      }
      return truncateRecords({ bin1, bin2, counts }, n)
    }

    throw new Error(`Unknown block type: ${type}`)
  }

  async getNormalizationVector(
    type: string,
    chr: string,
    unit: string,
    binSize: number,
  ) {
    await this.init()

    const chrIdx = this.chromosomeIndexMap[this.getFileChrName(chr)]
    if (chrIdx === undefined) {
      return undefined
    }
    const key = getNormalizationVectorKey(type, chrIdx, unit, binSize)

    // A plain `get` rather than has/get: unlike `matrixCache`, nothing is ever
    // cached as undefined here, so a miss and a cached absence are the same
    // answer.
    let result = this.normVectorCache.get(key)
    if (!result) {
      // A file with no vectors at all, or none for this (type, chr, unit,
      // binsize), simply answers undefined and the caller falls back to raw
      // counts. hic-straw warned to the console here; that fires once per
      // chromosome per region pair per fetch, and the console is the wrong place
      // for it anyway — `getContactRecords` reports the normalization it
      // actually applied so the display can tell the user.
      const idx = (await this.getNormVectorIndex())?.[key]
      if (idx) {
        const data = await this.file.read(idx.filePosition, 8)
        const parser = new BinaryParser(new DataView(data))
        const nValues = this.version < 9 ? parser.getInt() : parser.getLong()
        const dataType = this.version < 9 ? DOUBLE : FLOAT
        const filePosition =
          this.version < 9 ? idx.filePosition + 4 : idx.filePosition + 8
        result = new NormalizationVector(
          this.file,
          filePosition,
          nValues,
          dataType,
        )
        this.normVectorCache.set(key, result)
      }
    }
    return result
  }

  async getNormVectorIndex() {
    if (this.version >= 6) {
      // Memoize the *attempt*, not just a populated result. A legal (if
      // uncommon) v8 file with no norm vectors leaves `normVectorIndex`
      // undefined, and the old `!this.normVectorIndex` guard then re-ran the
      // discovery on every call — two calls per region pair per fetch, each
      // walking the whole normalized-expected-values section with a chain of
      // sequential range reads, only to rediscover there is nothing there.
      // Cleared on failure (like `init`) so a transient read error retries
      // rather than caching a rejection forever.
      this.normVectorIndexP ??= this.loadNormVectorIndex().catch(
        (e: unknown) => {
          this.normVectorIndexP = undefined
          throw e
        },
      )
      await this.normVectorIndexP
    }
    return this.normVectorIndex
  }

  private async loadNormVectorIndex() {
    // If we know the position of the norm vector index, read it directly.
    // This is the case for hic v9 files.
    if (this.normVectorIndexPosition > 0 && this.normVectorIndexSize > 0) {
      await this.readNormVectorIndex({
        start: this.normVectorIndexPosition,
        size: this.normVectorIndexSize,
      })
    } else if (this.config.nvi) {
      const nviArray = decodeURIComponent(this.config.nvi).split(',')
      await this.readNormVectorIndex({
        start: parseInt(nviArray[0]!),
        size: parseInt(nviArray[1]!),
      })
    } else {
      try {
        await this.readNormExpectedValuesAndNormVectorIndex()
      } catch (e) {
        if (isCode416(e)) {
          // Expected if file does not contain norm vectors
          this.normExpectedValueVectorsPosition = undefined
        } else {
          console.error(e)
        }
      }
    }
  }

  async getNormalizationOptions() {
    // Normalization options are computed as a side effect of loading the
    // index. A bit ugly but alternatives are worse.
    await this.getNormVectorIndex()
    return this.normalizationTypes
  }

  async readNormVectorIndex(range: { start: number; size: number }) {
    await this.init()
    const data = await this.file.read(range.start, range.size)
    const binaryParser = new BinaryParser(new DataView(data))
    this.normVectorIndex = {}
    let nEntries = binaryParser.getInt()
    while (nEntries-- > 0) {
      this.parseNormVectorEntry(binaryParser)
    }
    return this.normVectorIndex
  }

  // Used when the position of the norm vector index is unknown: read through
  // the expected values to find the index.
  async readNormExpectedValuesAndNormVectorIndex() {
    await this.init()
    if (this.normExpectedValueVectorsPosition !== undefined) {
      const nviStart = await this.skipExpectedValues(
        this.normExpectedValueVectorsPosition,
      )
      let byteCount = INT

      let data = await this.file.read(nviStart, INT)
      // Possible if there are no norm vectors. A legal v8 file, though uncommon.
      if (data.byteLength !== 0) {
        const binaryParser = new BinaryParser(new DataView(data))
        const nEntries = binaryParser.getInt()
        const sizeEstimate = nEntries * 30
        data = await this.file.read(nviStart + byteCount, sizeEstimate)
        this.normVectorIndex = {}

        const processEntries = async (remaining: number, buf: ArrayBuffer) => {
          const parser = new BinaryParser(new DataView(buf))
          let n = remaining
          while (n-- > 0) {
            if (parser.available() < 100) {
              n++ // Reset counter as entry is not processed
              byteCount += parser.position
              const est = Math.max(1000, n * 30)
              const more = await this.file.read(nviStart + byteCount, est)
              await processEntries(n, more)
              return
            }
            this.parseNormVectorEntry(parser)
          }
          byteCount += parser.position
        }

        await processEntries(nEntries, data)
        this.config.nvi = `${nviStart},${byteCount}`
      }
    }
  }

  // Used when the position of the norm vector index is unknown: skip the
  // normalized expected values to find the index.
  async skipExpectedValues(start: number) {
    const version = this.version
    const file = new BufferedFile({ file: this.file, size: 256000 })
    const data = await file.read(start, INT)
    const binaryParser = new BinaryParser(new DataView(data))
    const nEntries = binaryParser.getInt() // Total # of expected value chunks

    const parseNext = async (
      chunkStart: number,
      remaining: number,
    ): Promise<number> => {
      let chunkSize = 0
      const p0 = chunkStart

      let buf = await file.read(chunkStart, 500)
      let parser = new BinaryParser(new DataView(buf))
      parser.getString() // type
      parser.getString() // unit
      parser.getInt() // binSize
      const nValues = version < 9 ? parser.getInt() : parser.getLong()
      chunkSize += parser.position + nValues * (version < 9 ? DOUBLE : FLOAT)

      buf = await file.read(chunkStart + chunkSize, INT)
      parser = new BinaryParser(new DataView(buf))
      const nChrScaleFactors = parser.getInt()
      chunkSize +=
        INT + nChrScaleFactors * (INT + (version < 9 ? DOUBLE : FLOAT))

      return remaining - 1 === 0
        ? p0 + chunkSize
        : parseNext(p0 + chunkSize, remaining - 1)
    }

    return nEntries === 0 ? start + INT : parseNext(start + INT, nEntries)
  }

  parseNormVectorEntry(binaryParser: BinaryParser) {
    const type = binaryParser.getString() // 15
    const chrIdx = binaryParser.getInt() // 4
    const unit = binaryParser.getString() // 3
    const binSize = binaryParser.getInt() // 4
    const filePosition = binaryParser.getLong() // 8
    const sizeInBytes =
      this.version < 9 ? binaryParser.getInt() : binaryParser.getLong() // 4:8
    const key = `${type}_${chrIdx}_${unit}_${binSize}`

    if (!this.normalizationTypes.includes(type)) {
      this.normalizationTypes.push(type)
    }
    this.normVectorIndex![key] = { filePosition, size: sizeInBytes }
  }

  getFileChrName(chrAlias: string) {
    return this.chrAliasTable[chrAlias] ?? chrAlias
  }
}

function isCode416(e: unknown) {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e.code === '416' || e.code === 416)
  )
}
