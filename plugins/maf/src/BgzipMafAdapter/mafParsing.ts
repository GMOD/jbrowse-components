import { checkAbortSignal } from '@jbrowse/core/util/aborting'

import { wholeLines } from '../util/taiBlocks.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { KeepBlock, MafStanzaReader } from '../util/mafStanzaReader.ts'

/**
 * The MAF blocks of a decompressed slice into `sink`: an `a` line, then
 * `s`/`i`/`e`/`q` lines, terminated by a blank line. The lines are
 * `applyMafLine`'s grammar through `reader`, shared with bigMaf.
 *
 * Whether `keep` wants a block is settled at its reference row, and the rows
 * after it in a block it does not want are never parsed. A block is emitted
 * only once its terminator has been seen, and the final block only when the
 * slice ended on a line boundary: a byte-range read very often cuts its last
 * block mid-row, and a short sequence at real coordinates renders as a
 * plausible alignment that is simply wrong.
 */
export function readMafBlocks(
  text: string,
  blockIdAt: (textOffset: number) => string,
  reader: MafStanzaReader,
  sink: MafBlockSink,
  keep: KeepBlock,
  signal?: AbortSignal,
) {
  const { lines, endsClean } = wholeLines(text)
  let block: 'none' | 'unplaced' | 'kept' | 'skipped' = 'none'
  let blockOffset = 0
  let lineOffset = 0
  const flush = () => {
    if (block === 'kept') {
      reader.emitPlaced(sink, blockIdAt(blockOffset))
    }
    block = 'none'
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line === '') {
      flush()
    } else if (line.startsWith('a')) {
      flush()
      checkAbortSignal(signal)
      reader.begin()
      block = 'unplaced'
      blockOffset = lineOffset
    } else if (block === 'kept') {
      reader.line(line)
    } else if (block === 'unplaced') {
      reader.line(line)
      if (reader.hasReference) {
        block = reader.wanted(keep) ? 'kept' : 'skipped'
      }
    }
    lineOffset += raw.length + 1
  }
  if (endsClean) {
    flush()
  }
}
