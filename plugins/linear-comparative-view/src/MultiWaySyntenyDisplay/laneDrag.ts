import { mergeDomain, moveSectionTo } from '@jbrowse/display-kit/groupByMenu'

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
 * The row of the stack `order`, the anchor's included, that `name` dropped on
 * `row` takes. A lane dropped on the anchor's band lands beside it on its own
 * side, so only a drag of the anchor itself moves the anchor.
 */
export function dropTargetRow(
  order: readonly string[],
  name: string,
  row: number | undefined,
  anchor: string,
) {
  const anchorRow = order.indexOf(anchor)
  return row !== anchorRow || name === anchor
    ? row
    : order.indexOf(name) < anchorRow
      ? anchorRow - 1
      : anchorRow + 1
}

/**
 * `order` with `name` dropped on `row`; undefined for a drop that moves
 * nothing, since writing the order would pin every lane.
 */
export function laneOrderAfterDrop(
  order: string[],
  name: string,
  row: number | undefined,
  anchor: string,
) {
  const to = dropTargetRow(order, name, row, anchor)
  const moved = to === undefined ? order : moveSectionTo(order, name, to)
  return sameLaneOrder(moved, order) ? undefined : moved
}

/**
 * The `rows.sort` a drop writes: the moved order, the anchor named only where
 * it stacks below a lane or the sort already names it
 */
export function sortAfterDrop(
  domain: readonly string[],
  moved: readonly string[],
  anchor: string,
  keyOf: (name: string) => string,
) {
  const anchorKey = keyOf(anchor)
  const named = domain.some(name => keyOf(name) === anchorKey)
  return mergeDomain(
    domain,
    moved[0] === anchor && !named ? moved.slice(1) : moved,
  )
}

export function pastDragSlop(startY: number, y: number) {
  return Math.abs(y - startY) >= DRAG_SLOP_PX
}
