export type ReorderDirection = 'up' | 'down' | 'top' | 'bottom'

/**
 * Move `idx` within the subsequence of `arr` that `inScope` selects, leaving
 * every out-of-scope element where it sits.
 *
 * The scoped move: one list holds everything, but a move is only ever relative
 * to a subset of it. "Move this view up" in a tabbed workspace means up past the
 * previous view IN THIS PANEL, not past whatever happens to precede it in
 * `session.views` — which may be in another panel entirely and would make the
 * move look like a no-op.
 *
 * Implemented as a permutation of the in-scope positions: pull out the in-scope
 * elements, reorder that list, then write it back into the same index slots.
 * That is what keeps out-of-scope elements pinned, and what makes an unscoped
 * move (everything in scope) exactly `reorder`.
 */
export function reorderWithin<T>(
  arr: readonly T[],
  idx: number,
  direction: ReorderDirection,
  inScope: (item: T, index: number) => boolean,
): T[] {
  const slots: number[] = []
  const scoped: T[] = []
  for (const [i, item] of arr.entries()) {
    if (inScope(item, i)) {
      slots.push(i)
      scoped.push(item)
    }
  }
  const scopedIdx = slots.indexOf(idx)
  if (scopedIdx === -1) {
    return [...arr]
  }
  const moved = reorder(scoped, scopedIdx, direction)
  const next = [...arr]
  for (const [i, slot] of slots.entries()) {
    next[slot] = moved[i]!
  }
  return next
}

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

/**
 * Put the elements whose id appears in `ids` into that relative order, leaving
 * every other element in its own slot.
 *
 * The same slot permutation `reorderWithin` performs, driven by a stated order
 * rather than by a direction. It exists because an order can arrive in another
 * vocabulary entirely — a session spec's `layout` names views per panel, top to
 * bottom — and there is one list that order has to land in.
 *
 * Elements named in `ids` but absent from `arr` are ignored, so a layout may
 * name a view that failed to open.
 */
export function applyOrderWithin<T>(
  arr: readonly T[],
  ids: readonly string[],
  getId: (item: T) => string,
): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]))
  const slots: number[] = []
  for (const [i, item] of arr.entries()) {
    if (rank.has(getId(item))) {
      slots.push(i)
    }
  }
  const ordered = slots
    .map(i => arr[i]!)
    .sort((a, b) => rank.get(getId(a))! - rank.get(getId(b))!)
  const next = [...arr]
  for (const [i, slot] of slots.entries()) {
    next[slot] = ordered[i]!
  }
  return next
}
