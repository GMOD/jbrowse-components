import { observer } from 'mobx-react'

import { SidebarHintChip } from './SidebarHintChip.tsx'
import { focusRows } from './focusRows.ts'

import type { TreeSidebarModel } from './types.ts'

/**
 * Says that the rows on screen are a focused subset, and clears the focus on a
 * click. A subtree filter used to have no on-screen evidence at all: the rows
 * it hides are simply absent, and the only ways back were a menu item under
 * "Clustering" and the tree's own node popover — which is gone with the tree
 * once a reorder has invalidated it, though the filter itself survives.
 * Rendered by `TreeSidebar`, with or without a tree, so every way of focusing
 * rows (a node click, a legend click, a session's `rows.kept`) gets the same
 * way out.
 *
 * It sits in the line `rowFocusLineHeight` reserves directly above the first
 * row, so it covers no row's label: clicking it clears the focus, so it has no
 * dismissal that would leave the subset showing.
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
      top={rowsTop - model.rowFocusLineHeight}
      testId="row_focus_hint"
      hint={
        model.rowFocus
          ? {
              title: 'Click to show every row again',
              text: `Showing ${model.sources.length} rows`,
            }
          : undefined
      }
      onClick={() => {
        focusRows(model, undefined)
      }}
    />
  )
})
