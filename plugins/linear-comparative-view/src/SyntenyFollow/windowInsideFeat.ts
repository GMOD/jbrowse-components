import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Whether one alignment covers the whole anchor window, refName included: the
 * frame pass asks about the last settle's block against a live window that may
 * be on another contig.
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
