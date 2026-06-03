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
import { parseTaiIndex, selectIndexEntries } from './taiIndex.ts'
import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesFromConfig } from '../util/getSamples.ts'
import { lazyInit } from '../util/loadSubAdapter.ts'

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
    sampleIds?: Set<string>,
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
          const feature = blockToFeature(currentBlock, sampleIds)
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
      const feature = blockToFeature(currentBlock, sampleIds)
      if (feature) {
        yield feature
      }
    }
  }

  setupPre() {
    return lazyInit(this, () => this.doSetup())
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
    return parseTaiIndex(text)
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      try {
        const { index, runLengthEncodeBases } = await this.setup(opts)
        const sampleIds = buildSampleFilter(opts)

        // Get byte range for this query
        const records = index[query.refName]
        if (!records || records.length === 0) {
          observer.complete()
          return
        }

        const { firstEntry, nextEntry } = selectIndexEntries(
          records,
          query.start,
          query.end,
        )

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

        // subarray (not slice) — TextDecoder.decode handles either, and
        // subarray avoids a Uint8Array copy of what can be a sizable chunk.
        const slice = buffer.subarray(startOffset, endOffset)

        // Stream features using generator - no caching, immediate GC eligible
        for (const feat of this.parseTafBlocksStreaming(
          slice,
          runLengthEncodeBases,
          sampleIds,
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
}
