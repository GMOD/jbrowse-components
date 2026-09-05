import { flipBlockToForwardStrand } from '../util/forwardStrandBlock.ts'
import { applyMafLine } from '../util/mafLines.ts'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { SourceResolver } from '../util/parseAssemblyName.ts'
import type { TaiBlockFeature } from '../util/taiBlockFeatures.ts'

/** A parsed MAF block: the shared `.tai` block shape, plus MAF's `e` lines. */
export interface MafBlockFeature extends TaiBlockFeature {
  empties: Record<string, EmptyRecord>
}

/**
 * Stream MAF alignment blocks out of a decompressed slice.
 *
 * A MAF block is an `a` line followed by `s`/`i`/`e`/`q` lines and terminated by
 * a blank line. The per-line field parsing is `applyMafLine`, shared with the
 * bigMaf reader of the same grammar — so `e` lines become bridged rows and `i`
 * lines become their row's left/right context here exactly as they do there.
 * `s src start size strand srcSize text` — the first `s` line is the reference
 * row and fixes the block's genomic extent, taken before `resolve` so a
 * reference filtered out of the sample set still positions the block. A `-`
 * reference row is re-expressed forward first (`flipBlockToForwardStrand`).
 *
 * `trailingPartial` is the one thing this has to be careful about. The read is a
 * byte range, so its last block is very often cut mid-row; emitting it would put
 * a short sequence at real coordinates, which renders as a plausible alignment
 * that is simply wrong. A block is therefore only emitted once its terminator
 * has been seen, and the final block is emitted only when the buffer ended on a
 * clean line boundary.
 */
export function* parseMafBlocks(
  text: string,
  resolve: SourceResolver,
): Generator<MafBlockFeature> {
  // A slice that does not end on a newline had its last line truncated by the
  // byte range; that line cannot be trusted, and neither can the block holding
  // it.
  const endsClean = text.endsWith('\n')
  const lines = text.split('\n')

  let rows: {
    alignments: Record<string, AlignmentRecord>
    empties: Record<string, EmptyRecord>
  } = { alignments: {}, empties: {} }
  let refSrc: string | undefined
  let refStart = 0
  let refSize = 0
  let refStrand = 1
  let refSrcSize = 0
  let refSeq = ''
  let open = false

  const flush = () => {
    let done: MafBlockFeature | undefined
    if (open && refSrc !== undefined) {
      // A `-` reference row counts from the reverse complement, so the block is
      // turned over before anything reads its extent — see
      // `flipBlockToForwardStrand`. `strand` is then 1 either way, because the
      // block is now stated forward.
      const placed =
        refStrand === -1
          ? flipBlockToForwardStrand({
              refStart,
              refSize,
              refSrcSize,
              refSeq,
              alignments: rows.alignments,
              empties: rows.empties,
            })
          : { start: refStart, end: refStart + refSize, seq: refSeq }
      done = {
        // Qualified by the reference row's own name for the reason the TAF
        // path does it: start+size repeats across chromosomes, and a feature
        // id has to survive being read outside the query that produced it.
        uniqueId: `${refSrc}-${placed.start}-${refSize}`,
        refSrc,
        start: placed.start,
        end: placed.end,
        strand: 1,
        alignments: rows.alignments,
        empties: rows.empties,
        seq: placed.seq,
      }
    }
    rows = { alignments: {}, empties: {} }
    refSrc = undefined
    refStart = 0
    refSize = 0
    refStrand = 1
    refSrcSize = 0
    refSeq = ''
    open = false
    return done
  }

  for (const [i, raw] of lines.entries()) {
    const isLast = i === lines.length - 1
    // The final element of a split is '' when the text ended with a newline, so
    // an unterminated last line is exactly the non-empty final element.
    if (isLast && !endsClean && raw !== '') {
      break
    }
    const line = raw.trimEnd()
    if (line === '') {
      const done = flush()
      if (done) {
        yield done
      }
      continue
    }
    const type = line[0]
    if (type === 'a') {
      const done = flush()
      if (done) {
        yield done
      }
      open = true
      continue
    }
    // The `.tai` entry a slice begins at points at a block boundary, so the
    // leading `a` is present; a stray row before one is not a block.
    if (!open) {
      continue
    }
    const s = applyMafLine(line, resolve, rows)
    if (s !== undefined && refSrc === undefined) {
      refSrc = s.src
      refStart = s.start
      refSize = s.size
      refStrand = s.strand
      refSrcSize = s.srcSize
      refSeq = s.seq
    }
  }

  // Only when the slice ended cleanly; otherwise the open block is truncated.
  if (endsClean) {
    const done = flush()
    if (done) {
      yield done
    }
  }
}
