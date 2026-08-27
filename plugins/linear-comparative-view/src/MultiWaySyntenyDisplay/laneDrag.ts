import type { Lane } from './laneStack.ts'

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
