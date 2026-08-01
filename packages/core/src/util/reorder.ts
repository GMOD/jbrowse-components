export type ReorderDirection = 'up' | 'down' | 'top' | 'bottom'

/**
 * Move the element at `idx` within `arr` in the given direction, returning a new
 * array. An edge move (already at top/bottom) returns an unchanged copy.
 */
export function reorder<T>(
  arr: readonly T[],
  idx: number,
  direction: ReorderDirection,
): T[] {
  const next = [...arr]
  if (idx >= 0 && idx < arr.length) {
    const [item] = next.splice(idx, 1)
    const target =
      direction === 'up'
        ? Math.max(0, idx - 1)
        : direction === 'down'
          ? Math.min(arr.length - 1, idx + 1)
          : direction === 'top'
            ? 0
            : arr.length - 1
    next.splice(target, 0, item!)
  }
  return next
}
