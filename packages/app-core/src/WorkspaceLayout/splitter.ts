/**
 * Moving the boundary between two panes.
 *
 * Kept pure and separate from the handle that drives it, for the same reason
 * `dropZone.ts` is: this is the part with decisions in it — what the move is
 * measured against, how far it is allowed to go — and all of it is checkable
 * without rendering anything or synthesising a pointer. The DOM half is
 * `Splitter` in `LayoutRenderer.tsx` and is deliberately dumb.
 */

/**
 * A pane never shrinks below this many pixels.
 *
 * dockview's `MINIMUM_DOCKVIEW_GROUP_PANEL_WIDTH` / `..._HEIGHT`, which are both
 * 100, so this is the constraint the workspace shipped with before the grid
 * became ours. Sizes here are `flex-grow` shares and a share of zero is a legal
 * one, so without this a pane can be dragged — or `Home`'d — to nothing: the
 * cell vanishes, tab strip and views and all, and what is left to grab it back
 * with is a 4px sash flush against its neighbour.
 */
export const MIN_PANE_PX = 100

/** The space the two panes either side of the boundary before `index` share. */
export function pairSpan(sizes: number[], index: number) {
  return sizes[index - 1]! + sizes[index]!
}

/**
 * `sizes` with that boundary moved to `position`, measured in the same units.
 *
 * The move stays inside the pair, so every other pane holds still — what a
 * splitter is expected to do, and what "just scale everything" gets wrong. The
 * pointer and the arrow keys are the same gesture at two resolutions and both
 * land here.
 *
 * `pairPx` is how many pixels the pair currently occupies, and is the only
 * reason this function needs to know anything about pixels: `MIN_PANE_PX` is a
 * pixel constraint and the sizes are shares, so one has to be converted into
 * the other. Passing 0 (nothing measurable — jsdom, or a pane not laid out yet)
 * gives the unconstrained clamp rather than a division by zero.
 */
export function withBoundaryAt(
  sizes: number[],
  index: number,
  position: number,
  pairPx = 0,
) {
  const pair = pairSpan(sizes, index)
  // A pair with no room for two minimums splits the difference instead of
  // pinning both ends past each other — at `pair / 2` the boundary simply stops
  // in the middle, which is the only answer that keeps both panes visible.
  const floor =
    pairPx > 0 ? Math.min((MIN_PANE_PX / pairPx) * pair, pair / 2) : 0
  const before = Math.min(Math.max(position, floor), pair - floor)
  const next = [...sizes]
  next[index - 1] = before
  next[index] = pair - before
  return next
}
