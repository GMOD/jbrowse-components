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
 * rows (a node click, a legend click, a session's `subtreeFilter`) gets the
 * same way out.
 */
export const SubtreeFilterHint = observer(function SubtreeFilterHint({
  model,
  top = 0,
}: {
  model: TreeSidebarModel
  top?: number
}) {
  const count = model.subtreeFilter?.length
  return (
    <SidebarHintChip
      top={top}
      testId="subtree_filter_hint"
      hint={
        count
          ? {
              title: 'Click to show every row again',
              text: `Showing ${count} rows`,
            }
          : undefined
      }
      onClick={() => {
        focusRows(model, undefined)
      }}
    />
  )
})
