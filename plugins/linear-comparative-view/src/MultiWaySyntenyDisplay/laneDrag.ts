import { moveSectionTo } from '@jbrowse/display-kit/groupByMenu'

import type { Lane } from './laneStack.ts'

export const DRAG_SLOP_PX = 3

export function dropRowAt(lanes: Lane[], y: number) {
  const row = lanes.findIndex(lane => y >= lane.bandStart && y < lane.bandEnd)
  return row < 0 ? undefined : row
}

export function sameLaneOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

/**
 * undefined for a drop that moves nothing, since writing the order would pin
 * every lane.
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
