import type { Lane } from './laneStack.ts'

/** a press that travels less than this is a click, and shows no drop bar */
export const DRAG_SLOP_PX = 3

/** the row of the stack whose band holds `y`, or none outside the stack */
export function dropRowAt(lanes: Lane[], y: number) {
  const row = lanes.findIndex(lane => y >= lane.bandStart && y < lane.bandEnd)
  return row < 0 ? undefined : row
}

/**
 * `order` with `name` moved to index `to`, clamped to the stack. A drop on
 * the anchor's band is `to = -1` and lands the lane at the top of the mate
 * lanes, where "above the anchor" cannot be granted
 */
export function moveLaneTo(order: string[], name: string, to: number) {
  const from = order.indexOf(name)
  if (from < 0) {
    return order
  }
  const out = [...order]
  out.splice(from, 1)
  out.splice(Math.max(0, Math.min(to, out.length)), 0, name)
  return out
}

export function sameLaneOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((name, i) => name === b[i])
}

/**
 * The order a drop of `name` on `row` writes, or nothing when the drop leaves
 * the lanes where they are — a click, or a drop back on the lane's own row.
 * Writing the unchanged order would still pin every lane and end the
 * densest-first sort
 */
export function laneOrderAfterDrop(
  order: string[],
  name: string,
  row: number | undefined,
) {
  const moved = row === undefined ? order : moveLaneTo(order, name, row - 1)
  return sameLaneOrder(moved, order) ? undefined : moved
}

export function pastDragSlop(startY: number, y: number) {
  return Math.abs(y - startY) >= DRAG_SLOP_PX
}
