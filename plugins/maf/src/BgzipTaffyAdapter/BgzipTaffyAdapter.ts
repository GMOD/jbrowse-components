import { unzip } from '@gmod/bgzf-filehandle'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import { MafAdapterBase } from '../util/MafAdapterBase.ts'
import {
  readTaiIndex,
  taiBlockFeatures,
  taiRegionByteSize,
} from '../util/taiSlice.ts'
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

import type { MafAdapterOptions } from '../types.ts'
import type { SourceResolver } from '../util/parseAssemblyName.ts'
import type { TaiIndex } from '../util/taiSlice.ts'
import type { BgzipTaffyAdapterConfig } from './configSchema.ts'
import type { AlignmentBlock, TafFeature } from './tafParsing.ts'
import type { Region } from '@jbrowse/core/util'

interface SetupData extends TaiIndex {
  runLengthEncodeBases: boolean
}

/**
 * Adapter for TAF (Taffy Alignment Format) files compressed with BGZIP
 * Implements streaming parsing of TAF blocks into MAF features
 *
 * TAF Format: https://github.com/ComparativeGenomicsToolkit/taffy
 */
export default class BgzipTaffyAdapter extends MafAdapterBase<BgzipTaffyAdapterConfig> {
  // Not private: `BgzipTaffyAdapter.test.ts` asserts the header read resolves
  // the whole setup, and no public method reports `runLengthEncodeBases`.
  configure = cachedSetup({
    label: 'Downloading index',
    setup: () => this.doSetup(),
  })

  // utf-8 (default) tends to be faster than 'ascii' in modern engines.
  private decoder = new TextDecoder()

  async getRefNames() {
    const { index } = await this.configure()
    return [...index.keys()]
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
    // A slice that does not end on a newline had its last line cut by the byte
    // range, and that line cannot be trusted: a coordinate line cut before its
    // ` ; ` looks like a plain bases line and gets fed to `parseBasesColumn` as
    // one, so the trailing block ends up short a column or holding a fragment
    // of a coordinate string. Both put a wrong sequence at real coordinates.
    // `parseMafBlocks` guards the same way — the two readers share the problem
    // because they share the read.
    const endsClean = text.endsWith('\n')
    const lines = text.split('\n')

    for (const [i, line] of lines.entries()) {
      // The final element of a split is '' when the text ended with a newline,
      // so an unterminated last line is exactly the non-empty final element.
      if (i === lines.length - 1 && !endsClean && line !== '') {
        break
      }
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

    // Only when the slice ended cleanly: TAF has no block terminator, so a
    // block is complete exactly when the *next* coordinate line arrives — a cut
    // tail leaves the open one missing however many columns the cut removed.
    if (endsClean && currentBlock && columns.length > 0) {
      const feature = buildFeature(currentBlock, columns)
      if (feature) {
        yield feature
      }
    }
  }

  async doSetup(): Promise<SetupData> {
    const [tai, runLengthEncodeBases] = await Promise.all([
      readTaiIndex(this.getConf('taiLocation'), this.getConf('tafGzLocation')),
      this.readHeader(),
    ])
    return { ...tai, runLengthEncodeBases }
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
   * it breaks them too, and `cachedSetup` clears the memo so a transient error
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

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    return taiBlockFeatures({
      configure: this.configure,
      location: this.getConf('tafGzLocation'),
      query,
      opts,
      // Streamed from a generator — no caching, immediately GC eligible.
      parse: (slice, { runLengthEncodeBases }, resolve) =>
        this.parseTafBlocksStreaming(slice, runLengthEncodeBases, resolve),
    })
  }

  async getRegionByteSize(regions: Region[]) {
    return taiRegionByteSize(await this.configure(), regions)
  }
}
