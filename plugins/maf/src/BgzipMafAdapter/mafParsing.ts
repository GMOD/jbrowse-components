import { wholeLines } from '../util/taiBlocks.ts'

import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { KeepBlock, MafStanzaReader } from '../util/mafStanzaReader.ts'

/**
 * The MAF blocks of a decompressed slice into `sink`: an `a` line, then
 * `s`/`i`/`e`/`q` lines, terminated by a blank line. The lines are
 * `applyMafLine`'s grammar through `reader`, shared with bigMaf.
 *
 * A block is emitted only once its terminator has been seen, and the final
 * block only when the slice ended on a line boundary: a byte-range read very
 * often cuts its last block mid-row, and a short sequence at real coordinates
 * renders as a plausible alignment that is simply wrong.
 */
export function readMafBlocks(
  text: string,
  reader: MafStanzaReader,
  sink: MafBlockSink,
  keep: KeepBlock,
) {
  const { lines, endsClean } = wholeLines(text)
  let open = false
  const flush = () => {
    if (open) {
      reader.emitPlaced(sink, keep)
    }
    open = false
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line === '') {
      flush()
    } else if (line.startsWith('a')) {
      flush()
      reader.begin()
      open = true
    } else if (open) {
      reader.line(line)
    }
  }
  if (endsClean) {
    flush()
  }
}
