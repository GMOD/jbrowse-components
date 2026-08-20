import { observer } from 'mobx-react'

import { SidebarHintChip } from './SidebarHintChip.tsx'
import { treeDescribesRows } from './clusterUtils.ts'

import type { TreeSidebarModel } from './types.ts'

/**
 * Says why the dendrogram isn't there, when the reason is that it no longer
 * describes the rows.
 *
 * `computeClusterHierarchy` declines to position a tree whose leaves aren't the
 * rows on screen (see the package CLAUDE.md), which is the right answer — a
 * positioned stale tree labels every row with another row's name — but on its
 * own it is a tree that silently vanishes. Rendered by `TreeSidebar`, so every
 * display with a sidebar gets it without wiring anything up.
 *
 * Deliberately not a disabled control, a modal, or the centered `BlockMsg` the
 * blank-plot hints use: nothing is broken and nothing is lost — the rows are all
 * there, they are simply no longer in the order that was clustered, so the
 * message must not sit over the figure it is describing. Running clustering
 * again, or resetting the row order, brings a tree back.
 *
 * Click-to-dismiss because it does overlap the first row's label, and for one
 * display the state is permanent rather than transient: multi-row features'
 * `rowGroups` regroups `sources` downstream of `layout`, so a track configured
 * with both that and clustering can never position its tree. Dismissal is local
 * to the chip — it comes back on remount, since the condition genuinely still
 * holds.
 */
export const StaleTreeHint = observer(function StaleTreeHint({
  model,
  top = 0,
}: {
  model: TreeSidebarModel
  // Top of the hint, matching the top of the tree canvas (the display's
  // `rowsTopOffset`), so it sits at the head of the sidebar rather than up in
  // whatever the display reserves above its rows — the variants matrix display's
  // connector zone is user-draggable, so at 0 the hint floated arbitrarily far
  // above the rows it is talking about. Same contract as
  // `ClusterProvenanceHint`, which is its sibling in that gutter.
  top?: number
}) {
  const { root, sources, showTree } = model
  // `hierarchy` being undefined is not enough on its own — multi-wiggle's
  // overlay modes drop it deliberately, having no row axis to align to.
  const stale =
    showTree &&
    !!root &&
    !!sources?.length &&
    !model.hierarchy &&
    !treeDescribesRows(root, sources)
  return (
    <SidebarHintChip
      top={top}
      testId="stale_tree_hint"
      hint={
        stale
          ? {
              title:
                'Re-run clustering, or reset the row order, to bring the tree back. Click to dismiss.',
              text: 'Tree hidden — rows changed since clustering',
            }
          : undefined
      }
    />
  )
})
