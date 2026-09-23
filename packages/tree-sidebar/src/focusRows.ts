/**
 * Narrow a display to a set of rows, or clear the narrowing: the one write
 * behind clicking a tree node, a legend group and the "Clear subtree filter"
 * items. The scroll reset rides along because the filter re-lays-out the rows
 * from y=0, and without it the old offset strands a (usually shorter) subset at
 * the bottom, out of view.
 */
export function focusRows(model: FocusRowsModel, names?: string[]) {
  model.setRowFocus(names)
  model.setScrollTop(0)
}

interface FocusRowsModel {
  setRowFocus: (names?: readonly string[]) => void
  setScrollTop: (scrollTop: number) => void
}

/**
 * Focus the rows a legend group stands for — what clicking that swatch does on
 * the two displays whose key names rows rather than values.
 *
 * `rows` must be the list BEFORE the focus, which is the whole reason this is
 * worth sharing: a second click on another group has to reach the rows the
 * first click hid. What stays per display is only which rows one key row stands
 * for, since each derives its key differently (multi-wiggle from
 * `group ?? label ?? name`, the variant displays from the `rowColor` metadata
 * column).
 */
export function focusRowGroup<S extends { name: string }>(
  model: FocusRowsModel,
  rows: S[],
  inGroup: (row: S) => boolean,
) {
  focusRows(
    model,
    rows.filter(inGroup).map(s => s.name),
  )
}
