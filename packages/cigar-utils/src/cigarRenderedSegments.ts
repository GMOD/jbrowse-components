import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
  CIGAR_X,
} from './cigarConstants.ts'

// Indels narrower than this (in pixels) are merged into surrounding match
// context rather than rendered as separate quads. At 1px an indel resolving to
// a single pixel still renders — small on-screen detail is intentionally kept.
// The old 2px floor guarded against 1bp-indel aliasing on noisy long reads, but
// the synteny/dotplot CIGAR fill now fades sub-pixel indels by their true MSAA
// coverage instead of aliasing, so a genuinely sub-pixel indel fades honestly
// rather than flickering. A 1bp indel in a whole-chromosome view is far below
// 1px and still drops out here, as intended.
const MIN_INDEL_PX = 1

/**
 * Walks pre-parsed (packed int) CIGAR ops in bp-space and fires a callback
 * for each rendered segment. Small indels (width < MIN_INDEL_PX) are merged
 * into surrounding context; tiny M segments (both accumulators advance <
 * bpPerPx) are accumulated before emitting. A `CIGAR_RUN` word pair (the
 * coarse tier's fold of a run with its small indels) advances each axis by its
 * own length and is reported as CIGAR_M.
 *
 * Used by synteny and dotplot GPU renderers so both stay in sync.
 * Re-exported via @jbrowse/synteny-core for consistent import paths.
 *
 * Callback receives bp-space segment boundaries (cumBp, no inter-region
 * padding). Callers convert to screen positions with hp-math.
 */
export function visitCigarRenderedSegments(
  cigar: ArrayLike<number>,
  startBp1: number,
  startBp2: number,
  bpPerPx0: number,
  bpPerPx1: number,
  rev1: number,
  rev2: number,
  callback: (
    op: number,
    segBp1Start: number,
    segBp1End: number,
    segBp2Start: number,
    segBp2End: number,
  ) => void,
): void {
  let continuingFlag = false
  let segBp1Start = startBp1
  let segBp2Start = startBp2
  let bp1 = startBp1
  let bp2 = startBp2

  for (let j = 0; j < cigar.length; j++) {
    const packed = cigar[j]!
    const len = packed >>> 4
    const op = packed & 0xf

    if (!continuingFlag) {
      segBp1Start = bp1
      segBp2Start = bp2
    }

    if (op === CIGAR_RUN) {
      bp1 += len * rev1
      bp2 += (cigar[++j]! >>> 4) * rev2
    } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
      bp1 += len * rev1
      bp2 += len * rev2
    } else if (op === CIGAR_D || op === CIGAR_N) {
      bp1 += len * rev1
    } else if (op === CIGAR_I) {
      bp2 += len * rev2
    }

    if (op === CIGAR_D || op === CIGAR_N || op === CIGAR_I) {
      const relevantBpPerPx = op === CIGAR_I ? bpPerPx1 : bpPerPx0
      if (len < relevantBpPerPx * MIN_INDEL_PX) {
        continuingFlag = true
        continue
      }
    }

    const isNotLast = j < cigar.length - 1
    if (
      Math.abs(bp1 - segBp1Start) <= bpPerPx0 &&
      Math.abs(bp2 - segBp2Start) <= bpPerPx1 &&
      isNotLast
    ) {
      continuingFlag = true
    } else {
      const span1 = Math.abs(bp1 - segBp1Start)
      const span2 = Math.abs(bp2 - segBp2Start)
      const resolvedOp =
        span1 > bpPerPx0 || span2 > bpPerPx1
          ? op === CIGAR_RUN
            ? CIGAR_M
            : op
          : CIGAR_M
      continuingFlag = false
      callback(resolvedOp, segBp1Start, bp1, segBp2Start, bp2)
    }
  }

  // The merge above `continue`s PAST the flush, so a sub-pixel indel as the very
  // last op leaves the open segment unvisited: the `isNotLast` escape hatch that
  // forces a final emit is in the branch the `continue` skipped. The tail is
  // usually a base or two, but it is bounded only by how long a run of sub-pixel
  // indels the CIGAR ends with — 1000 trailing 1bp deletions at 100bp/px is 10px
  // of query axis that never reaches the callback, so a clipped block ending in
  // an indel run lost its trailing location markers, and in transparent-indels
  // mode its base tile too (a hole, since a tiled feature draws no full-span
  // base under it).
  //
  // Emitted as CIGAR_M rather than through the resolvedOp expression above: every
  // op merged into this segment was individually judged sub-pixel, so the last
  // one's kind is the wrong label for a span that may be mostly match.
  if (continuingFlag) {
    callback(CIGAR_M, segBp1Start, bp1, segBp2Start, bp2)
  }
}
