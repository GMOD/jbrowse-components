import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { treeDescribesRows } from './clusterUtils.ts'

import type { TreeSidebarModel } from './types.ts'

const useStyles = makeStyles()(theme => ({
  hint: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 100,
    padding: '1px 6px',
    fontSize: 11,
    lineHeight: '15px',
    borderBottomRightRadius: 4,
    color: theme.palette.text.secondary,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderTop: 'none',
    borderLeft: 'none',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
}))

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
 * component state — it comes back on remount, since the condition genuinely
 * still holds.
 */
export const StaleTreeHint = observer(function StaleTreeHint({
  model,
}: {
  model: TreeSidebarModel
}) {
  const { classes } = useStyles()
  const [dismissed, setDismissed] = useState(false)
  const { root, sources, showTree } = model
  // `hierarchy` being undefined is not enough on its own — multi-wiggle's
  // overlay modes drop it deliberately, having no row axis to align to.
  const stale =
    showTree &&
    !!root &&
    !!sources?.length &&
    !model.hierarchy &&
    !treeDescribesRows(root, sources)
  return stale && !dismissed ? (
    <div
      className={classes.hint}
      data-testid="stale_tree_hint"
      title="Re-run clustering, or reset the row order, to bring the tree back. Click to dismiss."
      onClick={() => {
        setDismissed(true)
      }}
    >
      Tree hidden — rows changed since clustering
    </div>
  ) : null
})
