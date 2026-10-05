/** A stretch of one lane contig and the anchor stretch it aligns to */
export interface LanePiece {
  lane: { start: number; end: number; orientation: number }
  anchor: { refName: string; start: number; end: number }
}

/**
 * The anchor bp between two pieces of one lane contig, read in the lane's
 * direction; undefined where they turn or change anchor refName, so the
 * anchor says nothing about the lane between them.
 */
export function anchorGapBetween(left: LanePiece, right: LanePiece) {
  return left.lane.orientation !== right.lane.orientation ||
    left.anchor.refName !== right.anchor.refName
    ? undefined
    : left.lane.orientation < 0
      ? left.anchor.start - right.anchor.end
      : right.anchor.start - left.anchor.end
}

/**
 * Each gap a lane contig's pieces, sorted by lane start, leave after the
 * furthest-reaching piece so far, so a piece nested inside a longer one opens
 * nothing beyond it. `laneGap` is negative where the pieces overlap.
 */
export function forEachLaneGap<T extends LanePiece>(
  sorted: readonly T[],
  visit: (
    left: T,
    right: T,
    laneGap: number,
    anchorGap: number | undefined,
  ) => void,
) {
  let reach = sorted[0]
  if (!reach) {
    return
  }
  for (let i = 1; i < sorted.length; i++) {
    const right = sorted[i]!
    visit(
      reach,
      right,
      right.lane.start - reach.lane.end,
      anchorGapBetween(reach, right),
    )
    if (right.lane.end > reach.lane.end) {
      reach = right
    }
  }
}
