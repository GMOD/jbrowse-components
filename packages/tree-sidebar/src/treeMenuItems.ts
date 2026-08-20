import { toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

import { MIN_SEPARATOR_ROW_PX } from './RowSeparatorLines.tsx'
import { describeClusterProvenance } from './clusterProvenance.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// The sidebar toggle's label. Exported because the website's figure recipes
// name it in a click path and must not re-spell it.
export const TREE_SIDEBAR_LABEL = 'Show sidebar with tree and labels'

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
  return toggleItem(
    'Tree branch lengths',
    self.showBranchLength,
    self.setShowBranchLength,
    {
      disabled: !self.showTree || !self.treeHasBranchLengths,
      disabledHelpText: self.showTree
        ? 'This tree has no branch lengths'
        : 'Show the tree first',
    },
  )
}

interface RowLabelsMenuModel {
  showTree: boolean
  showRowLabels: boolean
  setShowRowLabels: (arg: boolean) => void
}

/**
 * Shared "Show row labels" toggle. Every display with a sidebar had written its
 * own, and they had drifted in three ways at once — one called the slot
 * `showSidebarLabels`, one dropped the row from the menu entirely while the
 * tree was off, and one explained the swatch degradation that is true of all of
 * them (`SvgRowLabels` falls back to a `labelColor`
 * stripe below `MIN_TEXT_ROW_HEIGHT` whoever is drawing).
 *
 * `requiresTree` is a real difference rather than more drift: MAF mounts its
 * label overlay only under `showTree`, so with the tree off the toggle has
 * nothing to toggle, while canvas and multi-wiggle draw labels over the plot
 * with no gutter reserved and no tree needed. Disabled rather than dropped, so
 * the setting stays discoverable — a row that vanishes teaches the reader it
 * does not exist.
 */
export function showRowLabelsMenuItem(
  self: RowLabelsMenuModel,
  { requiresTree = false }: { requiresTree?: boolean } = {},
): MenuItem {
  return toggleItem(
    'Show row labels',
    self.showRowLabels,
    self.setShowRowLabels,
    {
      disabled: requiresTree && !self.showTree,
      disabledHelpText: 'Show the tree first',
      helpText:
        'below the height a name fits in, these become a column of color swatches — worth keeping when the colors are a grouping, worth turning off when they are per-row identity',
    },
  )
}

interface RowSeparatorsMenuModel {
  showRowSeparators: boolean
  effectiveRowHeight: number
  setShowRowSeparators: (arg: boolean) => void
}

/**
 * Shared "Show row separators" toggle, for the same reason
 * {@link showRowLabelsMenuItem} is shared: the canvas multi-row painting and
 * the multi-wiggle display had written it out identically, down to the hint
 * text, off the same `MIN_SEPARATOR_ROW_PX` threshold.
 *
 * Stays clickable below the height the lines draw at — the toggle is a setting,
 * and fewer rows or a taller track bring it back — but says so, rather than
 * silently doing nothing on a dense painting.
 */
export function showRowSeparatorsMenuItem(
  self: RowSeparatorsMenuModel,
): MenuItem {
  return toggleItem(
    withHint(
      'Show row separators',
      self.effectiveRowHeight < MIN_SEPARATOR_ROW_PX
        ? `needs rows ${MIN_SEPARATOR_ROW_PX}px or taller`
        : undefined,
    ),
    self.showRowSeparators,
    self.setShowRowSeparators,
  )
}

interface TreeSidebarMenuModel {
  showTree: boolean
  setShowTree: (arg: boolean) => void
}

// Shared "Show sidebar with tree and labels" toggle — the row every
// tree-sidebar consumer opens its sidebar group with, and the row
// `showRowLabelsMenuItem` and `treeBranchLengthMenuItem` both gate off. One
// label, so the three read as one group wherever they are assembled.
export function showTreeSidebarMenuItem(self: TreeSidebarMenuModel): MenuItem {
  return toggleItem(TREE_SIDEBAR_LABEL, self.showTree, self.setShowTree)
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

interface RowOrderMenuModel {
  layout: readonly unknown[]
  clearLayout: () => void
}

// "Reset row order", or nothing when the rows are still in discovered order —
// spread, don't insert.
//
// Gated on `layout` rather than on `clusterTree`, and so deliberately NOT in the
// clustering submenu: three things write the order — a clustering run, the
// colors/arrangement dialog, and the right-click sort — and only the first
// leaves a tree behind, so an item filed under "Clustering" undoes one of them
// while looking like it undoes all three. `clearLayout` resets any of them.
//
// Single-sourced here for the same reason as the subtree filter above: each
// display offers it from both its track menu and its context menu, so spelled
// out per call site it was four copies held together by a comment asserting
// they were one action.
export function resetRowOrderMenuItems(self: RowOrderMenuModel): MenuItem[] {
  return self.layout.length
    ? [
        {
          label: 'Reset row order',
          icon: RestartAltIcon,
          onClick: () => {
            self.clearLayout()
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
            toggleItem('Show tree', self.showTree, self.setShowTree, {
              disabled: !self.clusterTree,
              disabledHelpText: 'Run clustering first',
            }),
          ]
        : []),
      ...(treeApplies ? [treeBranchLengthMenuItem(self)] : []),
      ...clearSubtreeFilterMenuItems(self),
    ],
  }
}
