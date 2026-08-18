import { unzip } from '@gmod/bgzf-filehandle'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { buildSampleFilter, getSamplesMemoized } from '../util/getSamples.ts'
import { mafSummaryFeatures } from '../util/loadMafSummaryAdapter.ts'
import { lazyInit } from '../util/loadSubAdapter.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { readTaiSlice, taiRegionByteSize } from '../util/taiSlice.ts'
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
import { parseTaiIndex } from './taiIndex.ts'

import type { MafAdapterOptions } from '../types.ts'
import type { SamplesHolder } from '../util/getSamples.ts'
import type { MafSummaryHolder } from '../util/loadMafSummaryAdapter.ts'
import type { SourceResolver } from '../util/parseAssemblyName.ts'
import type { BgzipTaffyAdapterConfig } from './configSchema.ts'
import type { AlignmentBlock, TafFeature } from './tafParsing.ts'
import type { IndexData } from './types.ts'
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
export default class BgzipTaffyAdapter extends BaseFeatureDataAdapter<BgzipTaffyAdapterConfig> {
  public setupP?: Promise<SetupData>

  public samplesP?: SamplesHolder['samplesP']

  public summaryAdapterP?: MafSummaryHolder['summaryAdapterP']

  // true once the index has downloaded (set by lazyInit); gates the status label
  // so pan/zoom re-entry into setup() doesn't re-flash "Downloading index"
  public setupReady = false

  // utf-8 (default) tends to be faster than 'ascii' in modern engines.
  private decoder = new TextDecoder()

  async getRefNames() {
    const { index } = await this.setup()
    return Object.keys(index)
  }

  *parseTafBlocksStreaming(
    buffer: Uint8Array,
    runLengthEncodeBases: boolean,
    resolve: SourceResolver,
  ): Generator<TafFeature> {
    const buildFeature = (block: AlignmentBlock, cols: string[]) => {
      finalizeBlock(block, cols, this.decoder)
      return blockToFeature(block, resolve)
    }
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
        if (currentBlock) {
          if (columns.length > 0) {
            const feature = buildFeature(currentBlock, columns)
            if (feature) {
              yield feature
            }
          }
          // Advance the chain even for a block that emitted no feature. TAF
          // coordinates are deltas against the *immediately preceding* block
          // (parseCoordinatesAndEstablishBlock walks `pBlock`), so skipping one
          // silently reanchors every block after it — plausible-looking rows at
          // wrong coordinates rather than a visible failure. A column-less
          // block is only reachable from a malformed file, but the cost of
          // being wrong here is high and the cost of being right is nil.
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

    if (currentBlock && columns.length > 0) {
      const feature = buildFeature(currentBlock, columns)
      if (feature) {
        yield feature
      }
    }
  }

  setupPre() {
    return lazyInit(this, () => this.doSetup())
  }

  // Show "Downloading index" only while the index is genuinely downloading. Once
  // loaded, callers await the cached promise silently rather than re-flashing the
  // label on pan/zoom.
  setup(opts?: BaseOptions) {
    const { statusCallback } = opts ?? {}
    return this.setupReady
      ? this.setupPre()
      : updateStatus('Downloading index', statusCallback, () => this.setupPre())
  }

  async doSetup(): Promise<SetupData> {
    const [index, runLengthEncodeBases] = await Promise.all([
      this.readTaiFile(),
      this.readHeader(),
    ])
    return { index, runLengthEncodeBases }
  }

  /**
   * Whether the file's bases are run-length encoded, from its `#taf` header
   * line. A TAF may legitimately carry no header, and non-RLE is the right
   * answer there — so a *missing* header returns false.
   *
   * A failed **read** is not that, and used to be swallowed into the same
   * `false`. It is the one wrong answer this function can give that produces no
   * error: `parseBases` would take `"A 3 T 2"` for a literal sequence, so every
   * base of an RLE file would be silently wrong rather than the track failing.
   * Nothing was gained by absorbing it either — the read is the first 64KB of
   * the same file `getFeatures` reads its blocks from, so anything that breaks
   * it breaks them too, and `lazyInit` clears the memo so a transient error
   * retries.
   */
  async readHeader(): Promise<boolean> {
    const file = openLocation(this.getConf('tafGzLocation'))
    // One bgzf block is at most 64KiB compressed, so this always spans a whole
    // one; `unzip` decodes the complete blocks and stops, ignoring the partial
    // tail.
    const buffer = await unzip(await file.read(65536, 0))
    const firstLine = this.decoder.decode(buffer).split('\n', 1)[0] ?? ''
    return (
      firstLine.startsWith('#taf') &&
      firstLine.includes('run_length_encode_bases:1')
    )
  }

  async readTaiFile() {
    const text = await openLocation(this.getConf('taiLocation')).readFile(
      'utf8',
    )
    return parseTaiIndex(text)
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    const { statusCallback } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      const { index, runLengthEncodeBases } = await this.setup(opts)
      const resolver = makeSourceResolver(buildSampleFilter(opts))

      const slice = await readTaiSlice({
        index,
        refName: query.refName,
        start: query.start,
        end: query.end,
        location: this.getConf('tafGzLocation'),
        statusCallback,
      })
      if (!slice) {
        observer.complete()
        return
      }

      // Stream features using generator - no caching, immediate GC eligible
      for (const feat of this.parseTafBlocksStreaming(
        slice,
        runLengthEncodeBases,
        resolver.resolve,
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

      resolver.reportUnmatched()
      statusCallback?.('')
      observer.complete()
      // The stop token, like the tabix and bigMaf adapters pass: without it a
      // cancelled fetch (any pan or zoom) kept delivering into a subscriber
      // whose result was already discarded, and the abort never reached the
      // rxjs chain at all. The body's own errors need no try/catch either —
      // ObservableCreate forwards a rejected promise to `observer.error`.
    }, opts?.stopToken)
  }

  async getSamples() {
    return getSamplesMemoized(
      this,
      this.getConf('nhLocation'),
      this.getConf('samples'),
    )
  }

  // The zoom-out tier, same slot and same reader as the other three adapters'.
  // See the slot's own comment for why the `.tai` does not remove the need for
  // one.
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return mafSummaryFeatures(this, query, opts)
  }

  async getRegionByteSize(regions: Region[]) {
    const { index } = await this.setup()
    return taiRegionByteSize(index, regions)
  }
}
