import { useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  clusterProvenanceDrifted,
  clusterProvenanceLocLabel,
  describeClusterProvenance,
} from './clusterProvenance.ts'

import type { TreeSidebarModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  chip: {
    position: 'absolute',
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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
  },
  drifted: {
    color: theme.palette.warning.dark,
    borderColor: theme.palette.warning.main,
  },
}))

/**
 * Says which locus the dendrogram beside it was computed from.
 *
 * The tree is drawn whenever its leaves still name the rows on screen, and row
 * names do not change when you pan — so without this the same dendrogram sits
 * next to a different locus, or a different chromosome, looking exactly as
 * authoritative as it did where it was computed. That is the reading a figure
 * caption inherits, so the locus has to be on screen next to the tree rather
 * than only in the dialog that produced it.
 *
 * Two states, because "clustered elsewhere" and "clustered here" are different
 * claims and only one of them needs attention: below
 * `CLUSTER_PROVENANCE_MIN_OVERLAP` of the clustered span left in view, the chip
 * takes a warning color and says so. Ordinary panning inside the clustered
 * region stays in the quiet state — a warning that fires on every nudge is one
 * readers learn to stop seeing.
 *
 * Click-to-dismiss for the same reason `StaleTreeHint` is: it sits over the row
 * labels. Dismissal is local component state, so it returns on remount — the
 * tree's locus is a property of the tree, not a notification to be cleared.
 */
export const ClusterProvenanceHint = observer(function ClusterProvenanceHint({
  model,
  top = 0,
}: {
  model: TreeSidebarModel
  // Top of the chip, matching the top of the tree canvas (the display's
  // `lineZoneHeight`), so it sits at the head of the sidebar rather than over
  // whatever the display reserves above it.
  top?: number
}) {
  const { classes, cx } = useStyles()
  const [dismissed, setDismissed] = useState(false)
  const { clusterProvenance, hierarchy, showTree, treeAreaWidth } = model
  const view = getContainingView(model) as LinearGenomeViewModel

  // Gate on the *positioned* tree: a tree that isn't drawn has no locus worth
  // captioning, and `StaleTreeHint` is already explaining that case.
  if (!clusterProvenance || !hierarchy || !showTree || dismissed) {
    return null
  }
  const drifted = clusterProvenanceDrifted(
    clusterProvenance,
    view.dynamicBlocks.contentBlocks,
  )
  const description = describeClusterProvenance(clusterProvenance)
  return (
    <div
      className={cx(classes.chip, drifted ? classes.drifted : undefined)}
      data-testid="cluster_provenance_hint"
      title={`${description}. ${
        drifted
          ? 'You have navigated away from that region, so this tree does not describe what is on screen. Re-run clustering here, or reset the row order.'
          : 'Clustering reads only the region in view, so this tree describes that region and not the whole track.'
      } Click to dismiss.`}
      style={{ top, maxWidth: treeAreaWidth }}
      onClick={() => {
        setDismissed(true)
      }}
    >
      {drifted ? '⚠ ' : ''}
      {clusterProvenanceLocLabel(clusterProvenance)}
    </div>
  )
})
