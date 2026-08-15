import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Whether one alignment covers the whole anchor window, which is what decides
 * between the exact walk and the window mapping. The axis is the query one when
 * the mate row is moving, and the mate one when it is not.
 *
 * THE REFNAME IS PART OF IT, and only the frame pass needs that: the exact pass
 * asks about a block `pickFollowFeature` just picked ON the window's refName, so
 * they always agree, but the frame pass asks about the block the last settle
 * chose against a live window that may have moved to another contig. Overlapping
 * COORDINATES alone made that window look inside the old block, and the row was
 * placed through an unrelated alignment until the next settle corrected it.
 */
export function windowInsideFeat(
  feat: FeatPos,
  window: FollowWindow,
  toMate: boolean,
) {
  const { refName, start, end } = toMate ? feat : feat.mate
  return (
    refName === window.refName && start <= window.start && end >= window.end
  )
}
