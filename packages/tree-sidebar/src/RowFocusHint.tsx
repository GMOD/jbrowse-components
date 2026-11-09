import { observer } from 'mobx-react'

import { SidebarHintChip } from './SidebarHintChip.tsx'
import { rowColumnLabelsHeight } from './rowLabelsBoxWidth.ts'

import type { TreeSidebarModel } from './types.ts'

/**
 * Says that the rows on screen are a narrowed subset, "Showing N of M rows",
 * and where `rows.kept` or a reader's `rows.filter` narrows them, clears both
 * on a click ("Show all"), leaving a filter the config states. Rendered by
 * `TreeSidebar`, with or without a tree, so every way of narrowing the rows
 * (a node click, a legend click, a session's `rows.kept` or `rows.filter`)
 * gets the same way out. A narrowing nothing can clear, the config's own
 * filter, is a plain statement with no ✕: dismissed, it would leave its line
 * empty and hide a later clade pick's "Show all".
 *
 * It sits in the line `rowFocusLineHeight` reserves above the first row and
 * the color columns' labels, so it covers no label.
 */
export const RowFocusHint = observer(function RowFocusHint({
  model,
  rowsTop = 0,
}: {
  model: TreeSidebarModel
  rowsTop?: number
}) {
  return (
    <SidebarHintChip
      top={
        rowsTop -
        rowColumnLabelsHeight(model.rowColumnLabels) -
        model.rowFocusLineHeight
      }
      testId="row_focus_hint"
      hint={model.rowNarrowingHint}
      onClick={
        model.rowNarrowingClears
          ? () => {
              model.showAllRows()
              model.setScrollTop(0)
            }
          : undefined
      }
      dismissible={false}
    />
  )
})
