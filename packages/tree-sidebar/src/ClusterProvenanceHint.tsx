import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { SidebarHintChip } from './SidebarHintChip.tsx'
import {
  clusterProvenanceDrifted,
  clusterProvenanceLocLabel,
  describeClusterProvenance,
} from './clusterProvenance.ts'
import { treeIsShowing } from './treeSidebarGeometry.ts'

import type { TreeSidebarModel } from './types.ts'

/**
 * Warns that the dendrogram beside it was computed somewhere else.
 *
 * The tree is drawn whenever its leaves still name the rows on screen, and row
 * names do not change when you pan — so without this the same dendrogram sits
 * next to a different locus, or a different chromosome, looking exactly as
 * authoritative as it did where it was computed.
 *
 * It draws in ONE state, not two: below `CLUSTER_PROVENANCE_MIN_OVERLAP` of the
 * clustered span left in view. The quiet "clustered here" state used to draw as
 * well, and it was the wrong trade — it is the reading a viewer already assumes,
 * and on a captured figure it is text over the rows saying so. The locus is
 * still always retrievable (`clusterProvenanceMenuItems` in the Clustering
 * submenu, and `SvgTreeSidebar`'s export caption, which is the copy that ends up
 * under a figure); it is just no longer imposed on the frame.
 *
 * Drift being an overlap fraction rather than an equality test is what makes
 * that safe: ordinary panning inside the clustered region does not trip it, so
 * this chip appearing always means something.
 *
 * Click-to-dismiss for the same reason `StaleTreeHint` is: it sits over the row
 * labels. Dismissal is local to the chip, so it returns on remount — the tree's
 * locus is a property of the tree, not a notification to be cleared.
 */
export const ClusterProvenanceHint = observer(function ClusterProvenanceHint({
  model,
  top = 0,
}: {
  model: TreeSidebarModel
  // Top of the chip, matching the top of the tree canvas (the display's
  // `rowsTopOffset`), so it sits at the head of the sidebar rather than over
  // whatever the display reserves above it.
  top?: number
}) {
  const { clusterProvenance, treeAreaWidth } = model
  const view = containingLgv(model)
  // Gate on the *positioned* tree: a tree that isn't drawn has no locus worth
  // captioning, and `StaleTreeHint` is already explaining that case. Through
  // `treeIsShowing`, which is what "positioned" means — spelled out here as
  // `!hierarchy || !showTree` it was a fourth copy of a predicate the package
  // keeps in one place precisely because the gutter and what draws in it must
  // not disagree.
  //
  // ONLY the drifted state draws. The quiet one used to as well, and on a figure
  // it is noise sitting over the rows — "i dont want the tree 'context' text to
  // be displayed, that is just like...extra info for the track menu" (review).
  // It is genuinely extra there: a tree computed on what you are looking at is
  // the case a reader already assumes. Drift is the case that is silently wrong,
  // so that one keeps its chip.
  const drifted =
    !!clusterProvenance &&
    treeIsShowing(model) &&
    clusterProvenanceDrifted(
      clusterProvenance,
      view.dynamicBlocks.contentBlocks,
    )
  return (
    <SidebarHintChip
      warning
      top={top}
      maxWidth={treeAreaWidth}
      testId="cluster_provenance_hint"
      hint={
        clusterProvenance && drifted
          ? {
              title: `${describeClusterProvenance(clusterProvenance)}. You have navigated away from that region, so this tree does not describe what is on screen. Re-run clustering here, or reset the row order. Click to dismiss.`,
              text: `⚠ ${clusterProvenanceLocLabel(clusterProvenance)}`,
            }
          : undefined
      }
    />
  )
})
