import { revcom } from '@jbrowse/core/util'

import type { AlignmentRecord, EmptyRecord } from '../types.ts'

/**
 * Re-express a MAF/TAF block whose reference row is on `-` in forward reference
 * orientation. Spec-legal and rare — UCSC multiz and Cactus/taffy both put the
 * reference on `+` — but the bgzip readers take the block's extent from that
 * row, so `s hg38.chr1 1000 50 - 248956422` landed at `[1000, 1050)` instead of
 * `[248955372, 248955422)`, and no consumer can correct a block's `start`.
 *
 * The whole block turns over, not just the coordinate: flipping that alone
 * would leave the columns running backwards across a correctly placed span. So
 * every sequence reverse-complements, every strand negates, every row's `start`
 * re-expresses through its own `srcSize`, and each `i`-line context swaps left
 * for right — the standard MAF strand transform, applied uniformly.
 *
 * A `.tai` written against such a file indexes whatever frame its writer chose,
 * which this cannot know; what it guarantees is that the blocks a read does
 * return are placed where they belong.
 *
 * Mutates `alignments`/`empties` in place (both are per-block) and returns the
 * reference row's forward span.
 */
export function flipBlockToForwardStrand({
  refStart,
  refSize,
  refSrcSize,
  refSeq,
  alignments,
  empties,
}: {
  refStart: number
  refSize: number
  refSrcSize: number
  refSeq: string
  alignments: Record<string, AlignmentRecord>
  empties?: Record<string, EmptyRecord>
}) {
  for (const rec of Object.values(alignments)) {
    if (rec.srcSize !== undefined) {
      rec.start = rec.srcSize - rec.start - alignedBaseCount(rec.seq)
    }
    rec.seq = revcom(rec.seq)
    rec.strand = rec.strand === undefined ? undefined : -rec.strand
    if (rec.context) {
      rec.context = {
        leftStatus: rec.context.rightStatus,
        leftCount: rec.context.rightCount,
        rightStatus: rec.context.leftStatus,
        rightCount: rec.context.leftCount,
      }
    }
  }
  for (const rec of Object.values(empties ?? {})) {
    rec.start = rec.srcSize - rec.start - rec.size
    rec.strand = -rec.strand
  }
  const start = refSrcSize - refStart - refSize
  return { start, end: start + refSize, seq: revcom(refSeq) }
}

// A row's own aligned length. Counted rather than read off the `s` line, whose
// `size` field states it but is not carried onto an `AlignmentRecord`. `-` is
// the gap character MAF declares; the space is what the TAF reader writes for a
// row absent from a column (`finalizeBlock`), and the render path treats both as
// no base.
function alignedBaseCount(seq: string) {
  let n = 0
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i]
    if (c !== '-' && c !== ' ') {
      n++
    }
  }
  return n
}
