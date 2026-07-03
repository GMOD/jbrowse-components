// Vendored and converted to TypeScript from hic-straw (igvteam, MIT license)
// https://github.com/igvteam/hic-straw
//
// The original supported url/blob/local-path inputs and bundled its own
// zlib. This port accepts only a JBrowse filehandle and uses pako-esm2 for
// inflate; the remote IO layer, the legacy normalization-vector-index lookup
// table, and the FRAG-site code paths were dropped.

import { inflate } from 'pako-esm2'

import BinaryParser from './binary.ts'
import BufferedFile from './bufferedFile.ts'
import ContactRecord from './contactRecord.ts'
import LRU from './lru.ts'
import Matrix from './matrix.ts'
import NormalizationVector from './normalizationVector.ts'

import type MatrixZoomData from './matrixZoomData.ts'
import type {
  BlockIndexEntry,
  Chromosome,
  Filehandle,
  HicMetadata,
  HicRegion,
} from './types.ts'

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

class Block {
  constructor(
    public blockNumber: number,
    public zoomData: MatrixZoomData,
    public records: ContactRecord[],
    public idx: BlockIndexEntry,
  ) {}
}

class BlockCache {
  private resolution: number | undefined
  private map = new LRU<string, Block>(6)

  set(resolution: number, key: string, value: Block) {
    if (this.resolution !== resolution) {
      this.map.clear()
    }
    this.resolution = resolution
    this.map.set(key, value)
  }

  get(resolution: number, key: string) {
    return this.resolution === resolution ? this.map.get(key) : undefined
  }

  has(resolution: number, key: string) {
    return this.resolution === resolution && this.map.has(key)
  }
}

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
  private blockCache = new BlockCache()
  private normVectorIndexPosition = -1
  private normVectorIndexSize = -1

  private initialized = false
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
    if (!this.initialized) {
      await this.readHeaderAndFooter()
      this.initialized = true
    }
  }

  async getMetaData() {
    await this.init()
    return this.meta!
  }

  async readHeaderAndFooter() {
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

    const lo = Math.min(chrIdx1, chrIdx2)
    const hi = Math.max(chrIdx1, chrIdx2)
    const idx = this.masterIndex[Matrix.getKey(lo, hi)]
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
    allRecords = false,
  ) {
    await this.init()

    const idx1 = this.chromosomeIndexMap[this.getFileChrName(region1.chr)]
    const idx2 = this.chromosomeIndexMap[this.getFileChrName(region2.chr)]

    const transpose =
      idx1 !== undefined &&
      idx2 !== undefined &&
      (idx1 > idx2 || (idx1 === idx2 && region1.start >= region2.end))
    let r1 = region1
    let r2 = region2
    if (transpose) {
      r1 = region2
      r2 = region1
    }

    const blocks = await this.getBlocks(r1, r2, units, binsize)
    const contactRecords: ContactRecord[] = []
    if (blocks.length > 0) {
      const x1 = r1.start / binsize
      const x2 = r1.end / binsize
      const y1 = r2.start / binsize
      const y2 = r2.end / binsize
      const nvX1 = Math.floor(x1)
      const nvX2 = Math.ceil(x2)
      const nvY1 = Math.floor(y1)
      const nvY2 = Math.ceil(y2)
      const chr1 = this.getFileChrName(r1.chr)
      const chr2 = this.getFileChrName(r2.chr)

      for (const block of blocks) {
        // An undefined block is most likely a base-pair range outside the
        // chromosome
        if (block) {
          let isNorm = !!normalization && normalization !== 'NONE'
          let normVector1: number[] | undefined
          let normVector2: number[] | undefined
          if (isNorm) {
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
              normVector1 = await nv1.getValues(nvX1, nvX2)
              normVector2 = await nv2.getValues(nvY1, nvY2)
            } else {
              isNorm = false
            }
          }

          for (const rec of block.records) {
            if (
              allRecords ||
              (rec.bin1 >= x1 &&
                rec.bin1 < x2 &&
                rec.bin2 >= y1 &&
                rec.bin2 < y2)
            ) {
              if (isNorm && normVector1 && normVector2) {
                const x = rec.bin1
                const y = rec.bin2
                const nvnv = normVector1[x - nvX1]! * normVector2[y - nvY1]!
                // eslint-disable-next-line unicorn/prefer-number-properties -- vendored hic-straw, keep upstream form
                if (nvnv !== 0 && !isNaN(nvnv)) {
                  contactRecords.push(
                    new ContactRecord(x, y, rec.counts / nvnv),
                  )
                }
              } else {
                contactRecords.push(rec)
              }
            }
          }
        }
      }
    }

    return contactRecords
  }

  async getBlocks(
    region1: HicRegion,
    region2: HicRegion,
    unit: string,
    binSize: number,
  ) {
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
      const matrix = await this.getMatrix(idx1, idx2)
      if (!matrix) {
        console.warn(`No matrix for ${region1.chr}-${region2.chr}`)
      } else {
        const zd = matrix.getZoomData(binSize, unit)
        if (!zd) {
          throw new Error(
            `No data available for resolution: ${binSize} for map ${region1.chr}-${region2.chr}`,
          )
        }

        const blockNumbers = zd.getBlockNumbers(region1, region2, this.version)
        const blockNumbersToQuery: number[] = []
        for (const num of blockNumbers) {
          const key = blockKey(num, zd)
          if (this.blockCache.has(binSize, key)) {
            blocks.push(this.blockCache.get(binSize, key))
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
            this.blockCache.set(binSize, blockKey(block.blockNumber, zd), block)
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
      const nRecords = parser.getInt()
      const records: ContactRecord[] = []

      if (this.version < 7) {
        for (let i = 0; i < nRecords; i++) {
          const binX = parser.getInt()
          const binY = parser.getInt()
          const counts = parser.getFloat()
          records.push(new ContactRecord(binX, binY, counts))
        }
      } else {
        const binXOffset = parser.getInt()
        const binYOffset = parser.getInt()

        const useFloatContact = parser.getByte() === 1
        const useIntXPos = this.version < 9 ? false : parser.getByte() === 1
        const useIntYPos = this.version < 9 ? false : parser.getByte() === 1
        const type = parser.getByte()

        if (type === 1) {
          // List-of-rows representation
          const rowCount = useIntYPos ? parser.getInt() : parser.getShort()
          for (let i = 0; i < rowCount; i++) {
            const dy = useIntYPos ? parser.getInt() : parser.getShort()
            const binY = binYOffset + dy
            const colCount = useIntXPos ? parser.getInt() : parser.getShort()
            for (let j = 0; j < colCount; j++) {
              const dx = useIntXPos ? parser.getInt() : parser.getShort()
              const binX = binXOffset + dx
              const counts = useFloatContact
                ? parser.getFloat()
                : parser.getShort()
              records.push(new ContactRecord(binX, binY, counts))
            }
          }
        } else if (type === 2) {
          const nPts = parser.getInt()
          const w = parser.getShort()
          for (let i = 0; i < nPts; i++) {
            const row = Math.floor(i / w)
            const col = i - row * w
            const bin1 = binXOffset + col
            const bin2 = binYOffset + row
            if (useFloatContact) {
              const counts = parser.getFloat()
              // eslint-disable-next-line unicorn/prefer-number-properties -- vendored hic-straw, keep upstream form
              if (!isNaN(counts)) {
                records.push(new ContactRecord(bin1, bin2, counts))
              }
            } else {
              const counts = parser.getShort()
              if (counts !== Short_MIN_VALUE) {
                records.push(new ContactRecord(bin1, bin2, counts))
              }
            }
          }
        } else {
          throw new Error(`Unknown block type: ${type}`)
        }
      }

      block = new Block(blockNumber, zd, records, idx)
    }
    return block
  }

  async getNormalizationVector(
    type: string,
    chr: string,
    unit: string,
    binSize: number,
  ) {
    await this.init()

    const chrIdx = this.chromosomeIndexMap[this.getFileChrName(chr)]
    const key = getNormalizationVectorKey(type, chrIdx!, unit, binSize)

    let result: NormalizationVector | undefined
    if (this.normVectorCache.has(key)) {
      result = this.normVectorCache.get(key)
    } else {
      const normVectorIndex = await this.getNormVectorIndex()
      if (!normVectorIndex) {
        console.warn('Normalization vectors not present in this file')
      } else if (normVectorIndex[key] === undefined) {
        console.warn(
          `Normalization option ${type} not available at resolution ${binSize}. Will use NONE.`,
        )
      } else {
        const idx = normVectorIndex[key]
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
    if (this.version >= 6 && !this.normVectorIndex) {
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
    return this.normVectorIndex
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
