import { unzip } from '@gmod/bgzf-filehandle'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import {
  filterFirstLineInstructions,
  parseRowInstructions,
} from './rowInstructions.ts'
import {
  blockToFeature,
  finalizeBlock,
  parseBasesColumn,
  parseCoordinatesAndEstablishBlock,
} from './tafParsing.ts'
import VirtualOffset from './virtualOffset.ts'
import MafFeature from '../MafFeature.ts'
import { getSamplesFromConfig } from '../util/getSamples.ts'

import type { AlignmentBlock, TafFeature } from './tafParsing.ts'
import type { IndexData } from './types.ts'
import type { MafAdapterOptions } from '../types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

interface SetupData {
  index: IndexData
  runLengthEncodeBases: boolean
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

  // utf-8 (default) tends to be faster than 'ascii' in modern engines.
  private decoder = new TextDecoder()

  async getRefNames() {
    const { index } = await this.setup()
    return Object.keys(index)
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

    const text = this.decoder.decode(buffer)
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
          finalizeBlock(currentBlock, columns, this.decoder)
          const feature = blockToFeature(currentBlock, sampleFilter)
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

        currentBlock = parseCoordinatesAndEstablishBlock(pBlock, instructions)
        columns = []

        const bases = parseBasesColumn(basesAndTags, runLengthEncodeBases)
        if (bases.length > 0) {
          columns.push(bases)
        }
      } else if (currentBlock) {
        const bases = parseBasesColumn(trimmedLine, runLengthEncodeBases)
        if (bases.length > 0) {
          columns.push(bases)
        }
      }
    }

    // Finalize and yield last block
    if (currentBlock && columns.length > 0) {
      finalizeBlock(currentBlock, columns, this.decoder)
      const feature = blockToFeature(currentBlock, sampleFilter)
      if (feature) {
        yield feature
      }
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
      const text = this.decoder.decode(buffer)
      const firstLine = text.split('\n', 1)[0] ?? ''
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
    const entries: IndexData = {}
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
    return getSamplesFromConfig(key => this.getConf(key))
  }

  freeResources(): void {}
}
