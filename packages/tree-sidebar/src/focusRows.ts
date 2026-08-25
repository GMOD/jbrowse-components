/**
 * Narrow a display to a set of rows, or clear the narrowing: the one write
 * behind clicking a tree node, a legend group and the "Clear subtree filter"
 * items. The scroll reset rides along because the filter re-lays-out the rows
 * from y=0, and without it the old offset strands a (usually shorter) subset at
 * the bottom, out of view.
 */
export function focusRows(
  model: {
    setSubtreeFilter: (names?: string[]) => void
    setScrollTop?: (scrollTop: number) => void
  },
  names?: string[],
) {
  model.setSubtreeFilter(names)
  model.setScrollTop?.(0)
}
