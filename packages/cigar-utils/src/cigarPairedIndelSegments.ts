import { CIGAR_D, CIGAR_I, CIGAR_UNALIGNED } from './cigarConstants.ts'
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
 * to nothing on the other, not two events.
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
  let hasPending = false
  let pendingOp = 0
  let pendingBp1Start = 0
  let pendingBp1End = 0
  let pendingBp2Start = 0
  let pendingBp2End = 0

  const flushPending = () => {
    if (hasPending) {
      hasPending = false
      callback(
        pendingOp,
        pendingBp1Start,
        pendingBp1End,
        pendingBp2Start,
        pendingBp2End,
      )
    }
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
      if (hasPending && isPairedIndel(pendingOp, op)) {
        hasPending = false
        callback(
          CIGAR_UNALIGNED,
          pendingBp1Start,
          bp1End,
          pendingBp2Start,
          bp2End,
        )
      } else {
        flushPending()
        if (op === CIGAR_D || op === CIGAR_I) {
          hasPending = true
          pendingOp = op
          pendingBp1Start = bp1Start
          pendingBp1End = bp1End
          pendingBp2Start = bp2Start
          pendingBp2End = bp2End
        } else {
          callback(op, bp1Start, bp1End, bp2Start, bp2End)
        }
      }
    },
  )
  flushPending()
}
