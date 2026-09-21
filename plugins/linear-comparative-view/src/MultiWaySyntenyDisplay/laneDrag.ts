import { moveSectionTo } from '@jbrowse/display-kit/groupByMenu'

import type { Lane } from './laneStack.ts'

/** a press that travels less than this is a click, and shows no drop bar */
export const DRAG_SLOP_PX = 3

/** the row of the stack whose band holds `y`, or none outside the stack */
export function dropRowAt(lanes: Lane[], y: number) {
  const row = lanes.findIndex(lane => y >= lane.bandStart && y < lane.bandEnd)
  return row < 0 ? undefined : row
}

export function sameLaneOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

/**
 * The order a drop of `name` on `row` writes, or nothing when the drop leaves
 * the lanes where they are — a click, or a drop back on the lane's own row.
 * Writing the unchanged order would still pin every lane and end the
 * densest-first sort. `row` clamped to the stack; a drop on the anchor's
 * band is `row = 0` and lands the lane at the top of the mate lanes, where
 * "above the anchor" cannot be granted
 */
export function laneOrderAfterDrop(
  order: string[],
  name: string,
  row: number | undefined,
) {
  const moved = row === undefined ? order : moveSectionTo(order, name, row - 1)
  return sameLaneOrder(moved, order) ? undefined : moved
}

export function pastDragSlop(startY: number, y: number) {
  return Math.abs(y - startY) >= DRAG_SLOP_PX
}
