/**
 * Moving the boundary between two panes: pure, so it is checkable without a DOM
 * or a synthetic pointer. The handle in `LayoutRenderer.tsx` only measures.
 */

/**
 * A pane never shrinks below this many pixels.
 *
 * dockview's `MINIMUM_DOCKVIEW_GROUP_PANEL_WIDTH`/`_HEIGHT`. A `flex-grow`
 * share of zero is legal, so without it a pane can be dragged — or `Home`'d —
 * to nothing, taking its tab strip and views with it.
 */
export const MIN_PANE_PX = 100

/** The space the two panes either side of the boundary before `index` share. */
export function pairSpan(sizes: number[], index: number) {
  return sizes[index - 1]! + sizes[index]!
}

/**
 * `sizes` with that boundary moved to `position`, measured in the same units.
 *
 * The move stays inside the pair, so every other pane holds still. The pointer
 * and the arrow keys are the same gesture at two resolutions and both land here.
 *
 * `pairPx` is the pair's current pixel span, needed only to convert
 * `MIN_PANE_PX` into a share; 0 means nothing measurable (jsdom, or a pane not
 * laid out yet) and gives the unconstrained clamp.
 */
export function withBoundaryAt(
  sizes: number[],
  index: number,
  position: number,
  pairPx = 0,
) {
  const pair = pairSpan(sizes, index)
  // no room for two minimums: the boundary stops in the middle rather than
  // pinning both ends past each other
  const floor =
    pairPx > 0 ? Math.min((MIN_PANE_PX / pairPx) * pair, pair / 2) : 0
  const before = Math.min(Math.max(position, floor), pair - floor)
  const next = [...sizes]
  next[index - 1] = before
  next[index] = pair - before
  return next
}
