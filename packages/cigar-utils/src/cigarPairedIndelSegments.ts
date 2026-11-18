import { CIGAR_D, CIGAR_I, CIGAR_M, CIGAR_UNALIGNED } from './cigarConstants.ts'
import { visitCigarRenderedSegments } from './cigarRenderedSegments.ts'

type SegmentCallback = (
  op: number,
  segBp1Start: number,
  segBp1End: number,
  segBp2Start: number,
  segBp2End: number,
) => void

function isPairedIndel(a: number, b: number) {
  return (a === CIGAR_D && b === CIGAR_I) || (a === CIGAR_I && b === CIGAR_D)
}

/**
 * `visitCigarRenderedSegments`, except that a rendered deletion and insertion
 * meeting with no rendered match between them are reported as one
 * `CIGAR_UNALIGNED` segment spanning both: a stretch of each side that aligns
 * to nothing on the other, not two events. Match segments between them do not
 * keep them apart while the lesser of their two advances is at most a pixel on
 * the finer axis: matched bases advance both axes by the same bp, so they then
 * hold under a pixel of matches on either axis.
 */
export function visitCigarPairedIndelSegments(
  cigar: ArrayLike<number>,
  startBp1: number,
  startBp2: number,
  bpPerPx0: number,
  bpPerPx1: number,
  rev1: number,
  rev2: number,
  callback: SegmentCallback,
): void {
  let hasIndel = false
  let indelOp = 0
  let indelBp1Start = 0
  let indelBp1End = 0
  let indelBp2Start = 0
  let indelBp2End = 0
  let hasMatch = false
  let matchBp1End = 0
  let matchBp2End = 0

  const flushPending = () => {
    if (hasIndel) {
      callback(indelOp, indelBp1Start, indelBp1End, indelBp2Start, indelBp2End)
      if (hasMatch) {
        callback(CIGAR_M, indelBp1End, matchBp1End, indelBp2End, matchBp2End)
      }
    }
    hasIndel = false
    hasMatch = false
  }

  visitCigarRenderedSegments(
    cigar,
    startBp1,
    startBp2,
    bpPerPx0,
    bpPerPx1,
    rev1,
    rev2,
    (op, bp1Start, bp1End, bp2Start, bp2End) => {
      if (
        hasIndel &&
        op === CIGAR_M &&
        Math.min(
          Math.abs(bp1End - indelBp1End),
          Math.abs(bp2End - indelBp2End),
        ) <= Math.min(bpPerPx0, bpPerPx1)
      ) {
        hasMatch = true
        matchBp1End = bp1End
        matchBp2End = bp2End
      } else if (hasIndel && isPairedIndel(indelOp, op)) {
        hasIndel = false
        hasMatch = false
        callback(CIGAR_UNALIGNED, indelBp1Start, bp1End, indelBp2Start, bp2End)
      } else {
        flushPending()
        if (op === CIGAR_D || op === CIGAR_I) {
          hasIndel = true
          indelOp = op
          indelBp1Start = bp1Start
          indelBp1End = bp1End
          indelBp2Start = bp2Start
          indelBp2End = bp2End
        } else {
          callback(op, bp1Start, bp1End, bp2Start, bp2End)
        }
      }
    },
  )
  flushPending()
}
