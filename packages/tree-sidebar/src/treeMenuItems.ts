import { toggleItem, withHint } from '@jbrowse/core/ui/menuItems'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { MIN_SEPARATOR_ROW_PX } from './RowSeparatorLines.tsx'
import { MIN_CLUSTER_ROWS } from './clusterMatrix.ts'
import { describeClusterProvenance } from './clusterProvenance.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { MenuItem, NormalMenuItem } from '@jbrowse/core/ui'

// The tree toggle's label. Exported because the website's figure recipes name
// it in a click path and must not re-spell it.
export const TREE_SIDEBAR_LABEL = 'Show tree'

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
 * The labels draw with or without a tree on every display: `RowLabelsOverlay`
 * is mounted unconditionally and takes a zero offset when no dendrogram is
 * showing, so this toggle always has something to toggle.
 */
export function showRowLabelsMenuItem(self: RowLabelsMenuModel): MenuItem {
  return toggleItem(
    'Show row labels',
    self.showRowLabels,
    self.setShowRowLabels,
    {
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

interface TreeSidebarMenuModel extends BranchLengthMenuModel {
  clusterTree?: string
  setShowTree: (arg: boolean) => void
}

// Shared "Show tree" toggle. Disabled until there is a tree to show — a
// clustering run's, or the guide phylogeny a MAF adapter supplies — so it is
// never a no-op: `treeIsShowing` gates the gutter on the positioned tree, and
// with no `clusterTree` flipping `showTree` draws nothing either way.
export function showTreeSidebarMenuItem(self: TreeSidebarMenuModel): MenuItem {
  return toggleItem(TREE_SIDEBAR_LABEL, self.showTree, self.setShowTree, {
    disabled: !self.clusterTree,
    disabledHelpText: 'Run clustering first',
  })
}

/**
 * The two tree-display controls, as one group every row display opens its
 * "Show..." submenu with. They used to be split between that submenu and the
 * Clustering one, differently per display: a reader who found "Show tree"
 * under Clustering on a variant track looked there on a MAF track and found
 * nothing. Both are visibility toggles, and "Show..." is where those live;
 * Clustering is the operation.
 *
 * Spread into the submenu rather than returned as one item, so a display with
 * a rendering mode that has no row axis (multi-wiggle's overlays) can leave
 * them out along with its other row-only toggles.
 */
export function treeSidebarShowMenuItems(
  self: TreeSidebarMenuModel,
): MenuItem[] {
  return [showTreeSidebarMenuItem(self), treeBranchLengthMenuItem(self)]
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
// submenu and any display that has no clustering submenu to put it in.
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
  rowOrderIsCustom: boolean
  clearLayout: () => void
}

// "Reset row order", or nothing when the rows are still in discovered order —
// spread, don't insert.
//
// Gated on `rowOrderIsCustom` (the mixin's "has `layout` moved off what the
// config alone produces") rather than on `clusterTree`, and so deliberately NOT
// in the clustering submenu: three things write the order — a clustering run,
// the colors/arrangement dialog, and the right-click sort — and only the first
// leaves a tree behind, so an item filed under "Clustering" undoes one of them
// while looking like it undoes all three. `clearLayout` resets any of them.
//
// Single-sourced here for the same reason as the subtree filter above: each
// display offers it from both its track menu and its context menu, so spelled
// out per call site it was four copies held together by a comment asserting
// they were one action.
export function resetRowOrderMenuItems(self: RowOrderMenuModel): MenuItem[] {
  return self.rowOrderIsCustom
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

/**
 * The right-click "Sort rows by ... here" row: the interactive twin of the
 * declarative `sortRowsBy`. The label names what the display reads at the
 * column (the color painted there, the score, the base, the genotype) and
 * `onClick` is the display's own sort; what is shared is the gate and its
 * wording. Disabled rather than dropped below two rows, and says so — the rows
 * are discovered from loaded data on two of these displays, so a track panned
 * off its features is an ordinary state, not a defensive branch.
 */
export function sortRowsHereMenuItem({
  label,
  rowCount,
  onClick,
}: {
  label: string
  // `editableSources.length`: the list the sort orders, unfiltered by the
  // subtree, so a clade focused to one row still has rows to sort
  rowCount: number
  onClick: () => void
}): NormalMenuItem {
  return {
    label,
    icon: SwapVertIcon,
    disabled: rowCount < 2,
    disabledHelpText: 'Needs at least two rows to sort',
    onClick,
  }
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
  extends ClusterProvenanceMenuModel, SubtreeFilterMenuModel {}

// `disabled` and `disabledHelpText` are `BaseMenuItem`'s, which a divider and a
// subheader are not; neither is ever a run item, so they pass through untouched.
function withRowCountGate(item: MenuItem, rowCount: number): MenuItem {
  return item.type === 'divider' || item.type === 'subHeader'
    ? item
    : {
        ...item,
        disabled: rowCount < MIN_CLUSTER_ROWS,
        disabledHelpText: 'Needs at least two rows to cluster',
      }
}

// One "Clustering" submenu shape for every display that clusters its rows. Each
// display's own run item differs — it names what is being clustered — so it's
// passed in; what follows a run (the provenance, clearing the subtree filter)
// is identical and lives here, so the four menus can't drift into four
// layouts for one concept.
//
// The tree-display toggles are deliberately NOT here: they are visibility
// settings and sit in "Show..." with the rest (`treeSidebarShowMenuItems`).
// Nor is undoing a run. A display that clusters also writes its row order from
// an arrangement dialog and a right-click sort, and only a run leaves a
// `clusterTree` — so a reset filed under "Clustering" and gated on that tree
// undoes one of the three and looks like it undoes all of them. It belongs
// top-level, gated on `rowOrderIsCustom` (`resetRowOrderMenuItems`).
//
// Pass `rowCount` and the run row's `disabled` + `disabledHelpText` come from
// here instead, the way `sortRowsHereMenuItem` owns its own gate — the "needs
// two rows" rule is one rule and the four displays each spelled it. Omit it and
// the run row is used verbatim, which is what a display whose help text has to
// distinguish "still loading" from "only one row" still wants.
export function clusteringMenuItem(
  self: ClusteringMenuModel,
  runItem: MenuItem,
  rowCount?: number,
): MenuItem {
  return {
    label: 'Clustering',
    icon: AccountTreeIcon,
    type: 'subMenu',
    subMenu: [
      rowCount === undefined ? runItem : withRowCountGate(runItem, rowCount),
      ...clusterProvenanceMenuItems(self),
      ...clearSubtreeFilterMenuItems(self),
    ],
  }
}
