import { unzip } from '@gmod/bgzf-filehandle'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  filterFirstLineInstructions,
  parseRowInstructions,
} from './rowInstructions.ts'
import VirtualOffset from './virtualOffset.ts'
import MafFeature from '../MafFeature.ts'
import { getSamplesFromConfig } from '../util/getSamples.ts'
import { parseAssemblyAndChrSimple } from '../util/parseAssemblyName.ts'

import type { RowInstruction } from './rowInstructions.ts'
import type { AlignmentRecord, IndexData } from './types.ts'
import type { MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// Represents a row in the alignment (like Alignment_Row in C)
interface RowState {
  sequenceName: string
  start: number
  strand: number
  sequenceLength: number
  bases: string
  length: number
}

// Represents an alignment block (like Alignment in C)
interface AlignmentBlock {
  rows: RowState[]
  columnNumber: number
}

interface SetupData {
  index: IndexData
  runLengthEncodeBases: boolean
}

interface TafFeature {
  uniqueId: string
  start: number
  end: number
  strand: number
  alignments: Record<string, AlignmentRecord>
  seq: string
}

/**
 * Binary search to find the index of the first element >= target
 */
function lowerBound<T>(arr: T[], target: number, getKey: (item: T) => number) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (getKey(arr[mid]!) < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

/**
 * Adapter for TAF (Taffy Alignment Format) files compressed with BGZIP
 * Implements streaming parsing of TAF blocks into MAF features
 *
 * TAF Format: https://github.com/ComparativeGenomicsToolkit/taffy
 */
export default class BgzipTaffyAdapter extends BaseFeatureDataAdapter {
  public setupP?: Promise<SetupData>

  async getRefNames() {
    const { index } = await this.setup()
    return Object.keys(index)
  }

  // Faithful translation of parse_coordinates_and_establish_block from taf.c
  parseCoordinatesAndEstablishBlock(
    pBlock: AlignmentBlock | undefined,
    instructions: RowInstruction[],
  ): AlignmentBlock {
    const block: AlignmentBlock = {
      rows: [],
      columnNumber: 0,
    }

    // Copy rows from previous block
    if (pBlock) {
      for (const pRow of pBlock.rows) {
        block.rows.push({
          sequenceName: pRow.sequenceName,
          start: pRow.start + pRow.length,
          strand: pRow.strand,
          sequenceLength: pRow.sequenceLength,
          bases: '',
          length: 0,
        })
      }
    }

    // Apply coordinate instructions
    for (const ins of instructions) {
      if (ins.type === 'i') {
        block.rows.splice(ins.row, 0, {
          sequenceName: ins.sequenceName,
          start: ins.start,
          strand: ins.strand,
          sequenceLength: ins.sequenceLength,
          bases: '',
          length: 0,
        })
      } else if (ins.type === 's') {
        const row = block.rows[ins.row]
        if (row) {
          row.sequenceName = ins.sequenceName
          row.start = ins.start
          row.strand = ins.strand
          row.sequenceLength = ins.sequenceLength
        }
      } else if (ins.type === 'd') {
        if (block.rows[ins.row]) {
          block.rows.splice(ins.row, 1)
        }
      } else if (ins.type === 'g') {
        const row = block.rows[ins.row]
        if (row) {
          row.start += ins.gapLength
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      else if (ins.type === 'G') {
        const row = block.rows[ins.row]
        if (row) {
          row.start += ins.gapSubstring.length
        }
      }
    }

    return block
  }

  parseBases(basesStr: string, runLengthEncodeBases: boolean): string {
    if (runLengthEncodeBases) {
      const tokens = basesStr.split(' ')
      let result = ''
      for (let i = 0; i < tokens.length; i += 2) {
        const base = tokens[i]!
        const count = parseInt(tokens[i + 1]!, 10)
        if (!isNaN(count) && base.length === 1) {
          result += base.repeat(count)
        }
      }
      return result
    }
    return basesStr
  }

  // Streaming generator version of parseTafBlocks
  // Yields features one at a time instead of collecting into array
  *parseTafBlocksStreaming(
    buffer: Uint8Array,
    runLengthEncodeBases: boolean,
    sampleFilter?: Set<string>,
  ): Generator<TafFeature> {
    let pBlock: AlignmentBlock | undefined
    let currentBlock: AlignmentBlock | undefined
    let columns: string[] = []
    let isFirstCoordLine = true

    const decoder = new TextDecoder('ascii')
    const text = decoder.decode(buffer)
    const lines = text.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const semicolonIndex = trimmedLine.indexOf(' ; ')
      const hasCoordinates = semicolonIndex !== -1

      if (hasCoordinates) {
        // If we have a current block with columns, finalize and yield it
        if (currentBlock && columns.length > 0) {
          this.finalizeBlock(currentBlock, columns)
          const feature = this.blockToFeature(currentBlock, sampleFilter)
          if (feature) {
            yield feature
          }
          pBlock = currentBlock
        }

        // Parse the coordinate instructions
        const basesAndTags = trimmedLine.slice(0, semicolonIndex)
        let rowInstructions = trimmedLine.slice(semicolonIndex + 3)

        const atIndex = rowInstructions.indexOf(' @')
        if (atIndex !== -1) {
          rowInstructions = rowInstructions.slice(0, atIndex)
        }

        let instructions = parseRowInstructions(rowInstructions)

        if (isFirstCoordLine) {
          instructions = filterFirstLineInstructions(instructions)
          isFirstCoordLine = false
        }

        currentBlock = this.parseCoordinatesAndEstablishBlock(
          pBlock,
          instructions,
        )
        columns = []

        const basesAtIndex = basesAndTags.indexOf(' @')
        const basesOnly =
          basesAtIndex !== -1
            ? basesAndTags.slice(0, basesAtIndex)
            : basesAndTags
        const bases = this.parseBases(basesOnly.trim(), runLengthEncodeBases)
        if (bases.length > 0) {
          columns.push(bases)
        }
      } else if (currentBlock) {
        const basesAtIndex = trimmedLine.indexOf(' @')
        const basesOnly =
          basesAtIndex !== -1 ? trimmedLine.slice(0, basesAtIndex) : trimmedLine
        const bases = this.parseBases(basesOnly.trim(), runLengthEncodeBases)
        if (bases.length > 0) {
          columns.push(bases)
        }
      }
    }

    // Finalize and yield last block
    if (currentBlock && columns.length > 0) {
      this.finalizeBlock(currentBlock, columns)
      const feature = this.blockToFeature(currentBlock, sampleFilter)
      if (feature) {
        yield feature
      }
    }
  }

  // TextDecoder for efficient string building from typed array
  private decoder = new TextDecoder('ascii')

  finalizeBlock(block: AlignmentBlock, columns: string[]) {
    const numCols = columns.length
    block.columnNumber = numCols

    // Pre-allocate buffer for bases (reused across rows)
    const buffer = new Uint8Array(numCols)
    const DASH = 45 // '-'.charCodeAt(0)

    for (let j = 0; j < block.rows.length; j++) {
      const row = block.rows[j]!
      let length = 0

      for (let i = 0; i < numCols; i++) {
        const col = columns[i]!
        const charCode = col.charCodeAt(j)
        // Use dash if character doesn't exist (NaN from charCodeAt)
        buffer[i] = isNaN(charCode) ? DASH : charCode
        if (buffer[i] !== DASH) {
          length++
        }
      }

      row.bases = this.decoder.decode(buffer)
      row.length = length
    }
  }

  blockToFeature(
    block: AlignmentBlock,
    sampleFilter?: Set<string>,
  ): TafFeature | undefined {
    if (block.rows.length === 0 || block.columnNumber === 0) {
      return undefined
    }

    const row0 = block.rows[0]!
    const alignments: Record<string, AlignmentRecord> = {}

    for (const row of block.rows) {
      const { assemblyName, chr } = parseAssemblyAndChrSimple(row.sequenceName)
      if (sampleFilter && !sampleFilter.has(assemblyName)) {
        continue
      }
      alignments[assemblyName] = {
        chr,
        start: row.start,
        srcSize: row.sequenceLength,
        strand: row.strand,
        seq: row.bases,
      }
    }

    return {
      uniqueId: `${row0.start}-${row0.length}`,
      start: row0.start,
      end: row0.start + row0.length,
      strand: row0.strand,
      alignments,
      seq: row0.bases,
    }
  }

  setupPre() {
    this.setupP ??= this.doSetup().catch((e: unknown) => {
      this.setupP = undefined
      throw e
    })
    return this.setupP
  }

  setup(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return updateStatus('Downloading index', statusCallback, () =>
      this.setupPre(),
    )
  }

  async doSetup(): Promise<SetupData> {
    const [index, runLengthEncodeBases] = await Promise.all([
      this.readTaiFile(),
      this.readHeader(),
    ])
    return { index, runLengthEncodeBases }
  }

  async readHeader(): Promise<boolean> {
    try {
      const file = openLocation(this.getConf('tafGzLocation'))
      const response = await file.read(65536, 0)
      const buffer = await unzip(response)
      const decoder = new TextDecoder('ascii')
      const text = decoder.decode(buffer.slice(0, 1000))
      const firstLine = text.split('\n')[0] || ''
      if (firstLine.startsWith('#taf')) {
        return firstLine.includes('run_length_encode_bases:1')
      }
    } catch {
      // If we can't read the header, assume non-RLE
    }
    return false
  }

  async readTaiFile() {
    const text = await openLocation(this.getConf('taiLocation')).readFile(
      'utf8',
    )
    const lines = text
      .split('\n')
      .map(f => f.trim())
      .filter(line => line !== '')
    const entries = {} as IndexData
    let lastChr = ''
    let lastChrStart = 0
    let lastRawVirtualOffset = 0

    for (const line of lines) {
      const [chr, chrStart, virtualOffset] = line.split('\t')
      const isRelative = chr === '*'
      const currChr = isRelative ? lastChr : chr!.split('.').at(-1)!

      const absVirtualOffset = isRelative
        ? lastRawVirtualOffset + +virtualOffset!
        : +virtualOffset!
      const absChrStart = isRelative ? lastChrStart + +chrStart! : +chrStart!

      const blockPosition = Math.floor(absVirtualOffset / 65536)
      const dataPosition = absVirtualOffset % 65536
      const voff = new VirtualOffset(blockPosition, dataPosition)

      entries[currChr] ??= []
      entries[currChr].push({
        chrStart: absChrStart,
        virtualOffset: voff,
      })
      lastChr = currChr
      lastChrStart = absChrStart
      lastRawVirtualOffset = absVirtualOffset
    }
    return entries
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      try {
        const { index, runLengthEncodeBases } = await this.setup(opts)

        const sampleFilter = opts?.samples
          ? new Set(opts.samples.map(s => s.id))
          : undefined

        // Get byte range for this query
        const records = index[query.refName]
        if (!records || records.length === 0) {
          observer.complete()
          return
        }

        const getKey = (r: (typeof records)[0]) => r.chrStart
        const startIdx = lowerBound(records, query.start, getKey)
        const firstEntry = records[Math.max(startIdx - 1, 0)]
        const endIdx = lowerBound(records, query.end, getKey)
        const nextEntry = records[endIdx + 1] ?? records.at(-1)

        if (!firstEntry || !nextEntry) {
          observer.complete()
          return
        }

        // Read and decompress the data
        const file = openLocation(this.getConf('tafGzLocation'))
        const startBlock = firstEntry.virtualOffset.blockPosition
        const endBlock = nextEntry.virtualOffset.blockPosition

        const MIN_BLOCK_SIZE = 65536
        const readLength =
          endBlock > startBlock
            ? endBlock - startBlock + MIN_BLOCK_SIZE
            : MIN_BLOCK_SIZE

        const response = await updateStatus(
          'Downloading alignments',
          statusCallback,
          () => file.read(readLength, startBlock),
        )
        const buffer = await unzip(response)

        const startOffset = firstEntry.virtualOffset.dataPosition
        const nextOffset = nextEntry.virtualOffset.dataPosition
        const endOffset =
          endBlock === startBlock && nextOffset > startOffset
            ? nextOffset
            : buffer.length

        const slice = buffer.slice(startOffset, endOffset)

        // Stream features using generator - no caching, immediate GC eligible
        for (const feat of this.parseTafBlocksStreaming(
          slice,
          runLengthEncodeBases,
          sampleFilter,
        )) {
          // Filter features that overlap with query region
          if (feat.end > query.start && feat.start < query.end) {
            observer.next(
              new MafFeature(
                feat.uniqueId,
                feat.start,
                feat.end,
                query.refName,
                feat.strand,
                feat.alignments,
                feat.seq,
              ),
            )
          }
        }

        statusCallback('')
        observer.complete()
      } catch (e) {
        observer.error(e)
      }
    })
  }

  async getSamples() {
    return getSamplesFromConfig(this.getConf.bind(this))
  }

  freeResources(): void {}
}
