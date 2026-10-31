import { unzip } from '@gmod/bgzf-filehandle'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import { MafTaiAdapterBase } from '../util/MafTaiAdapterBase.ts'
import { wholeLines } from '../util/taiBlocks.ts'
import { readTaiIndex } from '../util/taiSlice.ts'
import {
  filterFirstLineInstructions,
  parseRowInstructions,
} from './rowInstructions.ts'
import {
  finalizeBlock,
  findCoordinateSeparator,
  parseBasesColumn,
  parseCoordinatesAndEstablishBlock,
  readTafBlock,
  withoutTags,
} from './tafParsing.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { KeepBlock, MafStanzaReader } from '../util/mafStanzaReader.ts'
import type { TaiIndex, TaiSlice } from '../util/taiSlice.ts'
import type { BgzipTaffyAdapterConfig } from './configSchema.ts'
import type { AlignmentBlock } from './tafParsing.ts'

interface SetupData extends TaiIndex {
  runLengthEncodeBases: boolean
}

/**
 * Adapter for TAF (Taffy Alignment Format) files compressed with BGZIP
 * Implements streaming parsing of TAF blocks into MAF features
 *
 * TAF Format: https://github.com/ComparativeGenomicsToolkit/taffy
 */
export default class BgzipTaffyAdapter extends MafTaiAdapterBase<
  BgzipTaffyAdapterConfig,
  SetupData
> {
  // Not private: `BgzipTaffyAdapter.test.ts` asserts the header read resolves
  // the whole setup, and no public method reports `runLengthEncodeBases`.
  configure = cachedSetup({
    label: 'Downloading index',
    setup: opts => this.doSetup(opts.signal),
  })

  protected dataLocation() {
    return this.getConf('tafGzLocation')
  }

  protected readSlice(
    slice: TaiSlice,
    { runLengthEncodeBases }: SetupData,
    reader: MafStanzaReader,
    sink: MafBlockSink,
    keep: KeepBlock,
  ) {
    this.readTafSlice(slice, runLengthEncodeBases, reader, sink, keep)
  }

  readTafSlice(
    { bytes, blockIdAt }: TaiSlice,
    runLengthEncodeBases: boolean,
    reader: MafStanzaReader,
    sink: MafBlockSink,
    keep: KeepBlock,
  ) {
    let pBlock: AlignmentBlock | undefined
    let currentBlock: AlignmentBlock | undefined
    let columns: string[] = []
    let isFirstCoordLine = true
    let blockOffset = 0
    let lineOffset = 0
    const emit = (block: AlignmentBlock, cols: string[]) => {
      finalizeBlock(block, cols, this.decoder)
      readTafBlock(block, reader, sink, keep, blockIdAt(blockOffset))
    }

    // A cut coordinate line is the one `wholeLines` has to drop here: cut
    // before its ` ; ` it looks like a plain bases line and reaches
    // `parseBasesColumn` as one.
    const { lines, endsClean } = wholeLines(this.decoder.decode(bytes))

    for (const line of lines) {
      const lineStart = lineOffset
      lineOffset += line.length + 1
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const semicolonIndex = findCoordinateSeparator(trimmedLine)
      const hasCoordinates = semicolonIndex !== -1

      if (hasCoordinates) {
        if (currentBlock) {
          if (columns.length > 0) {
            emit(currentBlock, columns)
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
        let instructions = parseRowInstructions(
          withoutTags(trimmedLine.slice(semicolonIndex + 3)),
        )

        if (isFirstCoordLine) {
          instructions = filterFirstLineInstructions(instructions)
          isFirstCoordLine = false
        }

        currentBlock = parseCoordinatesAndEstablishBlock(pBlock, instructions)
        blockOffset = lineStart
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
      emit(currentBlock, columns)
    }
  }

  async doSetup(signal?: AbortSignal): Promise<SetupData> {
    const [tai, runLengthEncodeBases] = await Promise.all([
      readTaiIndex(this.getConf('taiLocation'), this.pluginManager, signal),
      this.readHeader(signal),
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
  async readHeader(signal?: AbortSignal): Promise<boolean> {
    const file = openLocation(this.getConf('tafGzLocation'), this.pluginManager)
    // One bgzf block is at most 64KiB compressed, so this always spans a whole
    // one; `unzip` decodes the complete blocks and stops, ignoring the partial
    // tail.
    const buffer = await unzip(await file.read(65536, 0, { signal }))
    const firstLine = this.decoder.decode(buffer).split('\n', 1)[0] ?? ''
    return (
      firstLine.startsWith('#taf') &&
      firstLine.includes('run_length_encode_bases:1')
    )
  }
}
