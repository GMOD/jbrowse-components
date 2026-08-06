import { checkboxItem } from '@jbrowse/core/ui/menuItems'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

import { describeClusterProvenance } from './clusterProvenance.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface BranchLengthMenuModel {
  showTree: boolean
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  setShowBranchLength: (arg: boolean) => void
}

// Shared "Tree branch lengths" toggle for the tree-sidebar consumers. Disabled
// when the tree is hidden or carries no merge heights (so it's never a no-op);
// `treeHasBranchLengths` is false when there's no tree at all, so it also covers
// the not-yet-clustered case.
export function treeBranchLengthMenuItem(
  self: BranchLengthMenuModel,
): MenuItem {
  return checkboxItem(
    'Tree branch lengths',
    self.showBranchLength,
    () => {
      self.setShowBranchLength(!self.showBranchLength)
    },
    {
      disabled: !self.showTree || !self.treeHasBranchLengths,
      disabledHelpText: self.showTree
        ? 'This tree has no branch lengths'
        : 'Show the tree first',
    },
  )
}

interface SubtreeFilterMenuModel {
  subtreeFilter?: readonly string[]
  setSubtreeFilter: (arg?: string[]) => void
}

// "Clear subtree filter", or nothing when no filter is set — spread, don't
// insert. Every display that can focus a clade needs this escape hatch and needs
// it to survive the tree: the filter is a set of row names, so it keeps hiding
// rows after a reorder has invalidated the dendrogram whose node-click set it,
// and the tree's own context menu is gone with the tree. Returned as a list so
// the one label and the one gate are single-sourced across the clustering
// submenu and the displays (maf) that have no clustering submenu to put it in.
export function clearSubtreeFilterMenuItems(
  self: SubtreeFilterMenuModel,
): MenuItem[] {
  return self.subtreeFilter?.length
    ? [
        {
          label: 'Clear subtree filter',
          onClick: () => {
            self.setSubtreeFilter(undefined)
          },
        },
      ]
    : []
}

interface ClusterProvenanceMenuModel {
  clusterProvenance?: ClusterProvenance
}

// "Clustered on <locus>", or nothing when the tree was supplied rather than
// computed (maf's `.nh`) — spread, don't insert.
//
// This is where the locus lives now. `ClusterProvenanceHint` used to put it on
// screen in both of its states, and the quiet one is text over the rows stating
// what a viewer already assumes; the chip now draws only when the view has
// drifted off the clustered span, which is the case that is silently wrong. The
// information itself still has to be reachable, because "which region is this
// tree from" has no other answer once the chip is gone and a dendrogram beside
// the wrong locus looks exactly like one beside the right locus.
//
// Disabled because it is a fact and not an action; `disabledHelpText` carries
// the full sentence (`describeClusterProvenance`) that the label abbreviates.
export function clusterProvenanceMenuItems(
  self: ClusterProvenanceMenuModel,
): MenuItem[] {
  const provenance = self.clusterProvenance
  return provenance
    ? [
        {
          label: describeClusterProvenance(provenance),
          disabled: true,
          disabledHelpText:
            'Clustering reads only the region in view, so this tree describes that region and not the whole track',
          onClick: () => {},
        },
      ]
    : []
}

interface ClusteringMenuModel
  extends
    BranchLengthMenuModel,
    ClusterProvenanceMenuModel,
    SubtreeFilterMenuModel {
  clusterTree?: string
  setShowTree: (arg: boolean) => void
}

// One "Clustering" submenu shape for every display that clusters its rows
// (multi-row features, multi-sample variants, multi-wiggle). Each display's own
// run item differs — it names what is being clustered, and only some open a
// dialog — so it's passed in; everything downstream of a run (the tree toggle,
// branch lengths, clearing the subtree filter) is identical and lives here, so
// the three menus can't drift into three different layouts for one concept.
//
// Undoing a run is deliberately NOT here. A display that clusters also writes
// its row order from an arrangement dialog and (multi-row features, multi-
// wiggle) a right-click sort, and only a run leaves a `clusterTree` — so a
// reset filed under "Clustering" and gated on that tree undoes one of the three
// and looks like it undoes all of them. It belongs top-level, gated on `layout`
// (`clearLayout` resets any of them), which is where both of those displays
// keep theirs.
//
// `showTreeToggle` is opt-out because `showTree` does not mean the same thing
// everywhere: on variants and wiggle it reveals only the dendrogram, so it
// belongs here, but on the multi-row display it gates the whole sidebar
// (dendrogram AND row labels), which is useful with no clustering run at all.
// Filing that toggle under "Clustering" would bury it, so that display keeps it
// top-level and opts out.
//
// `treeApplies` is false when the display's current rendering mode has no row
// axis for a dendrogram to align to (multi-wiggle's overlay modes collapse every
// source onto one row). Both tree-display controls then drop out entirely rather
// than sitting there as no-ops — a persisted `showTree` is left untouched, so it
// comes back on return to a row mode.
export function clusteringMenuItem(
  self: ClusteringMenuModel,
  runItem: MenuItem,
  {
    showTreeToggle = true,
    treeApplies = true,
  }: {
    showTreeToggle?: boolean
    treeApplies?: boolean
  } = {},
): MenuItem {
  return {
    label: 'Clustering',
    icon: AccountTreeIcon,
    type: 'subMenu',
    subMenu: [
      runItem,
      ...clusterProvenanceMenuItems(self),
      ...(showTreeToggle && treeApplies
        ? [
            checkboxItem(
              'Show tree',
              self.showTree,
              () => {
                self.setShowTree(!self.showTree)
              },
              {
                disabled: !self.clusterTree,
                disabledHelpText: 'Run clustering first',
              },
            ),
          ]
        : []),
      ...(treeApplies ? [treeBranchLengthMenuItem(self)] : []),
      ...clearSubtreeFilterMenuItems(self),
    ],
  }
}
