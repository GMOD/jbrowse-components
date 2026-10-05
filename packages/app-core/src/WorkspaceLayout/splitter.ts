// a `flex-grow` share of zero is legal, so this keeps a pane from vanishing
export const MIN_PANE_PX = 100

/** The space the two panes either side of the boundary before `index` share. */
export function pairSpan(sizes: number[], index: number) {
  return sizes[index - 1]! + sizes[index]!
}

/**
 * `sizes` with that boundary moved to `position`, in the same units; other
 * panes hold still. `pairPx` converts `MIN_PANE_PX` to a share; 0 (jsdom, or
 * not laid out) skips the minimum.
 */
export function withBoundaryAt(
  sizes: number[],
  index: number,
  position: number,
  pairPx = 0,
) {
  const pair = pairSpan(sizes, index)
  // with no room for two minimums the boundary stops in the middle
  const floor =
    pairPx > 0 ? Math.min((MIN_PANE_PX / pairPx) * pair, pair / 2) : 0
  const before = Math.min(Math.max(position, floor), pair - floor)
  const next = [...sizes]
  next[index - 1] = before
  next[index] = pair - before
  return next
}
