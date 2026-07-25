import AccountTreeIcon from '@mui/icons-material/AccountTree'

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
  return {
    label: 'Tree branch lengths',
    type: 'checkbox',
    checked: self.showBranchLength,
    disabled: !self.showTree || !self.treeHasBranchLengths,
    onClick: () => {
      self.setShowBranchLength(!self.showBranchLength)
    },
  }
}

interface ClusteringMenuModel extends BranchLengthMenuModel {
  clusterTree?: string
  subtreeFilter?: readonly string[]
  setShowTree: (arg: boolean) => void
  setSubtreeFilter: (arg?: string[]) => void
}

// One "Clustering" submenu shape for every display that clusters its rows
// (multi-row features, multi-sample variants, multi-wiggle). Each display's own
// run item differs — it names what is being clustered, and only some open a
// dialog — so it's passed in; everything downstream of a run (the tree toggle,
// branch lengths, clearing the subtree filter) is identical and lives here, so
// the three menus can't drift into three different layouts for one concept.
//
// `extraItems` land after the run item, for a display that can also undo the
// clustering itself (the multi-row display's "Clear clustering").
//
// `showTreeToggle` is opt-out because `showTree` does not mean the same thing
// everywhere: on variants and wiggle it reveals only the dendrogram, so it
// belongs here, but on the multi-row display it gates the whole sidebar
// (dendrogram AND row labels), which is useful with no clustering run at all.
// Filing that toggle under "Clustering" would bury it, so that display keeps it
// top-level and opts out.
export function clusteringMenuItem(
  self: ClusteringMenuModel,
  runItem: MenuItem,
  {
    extraItems = [],
    showTreeToggle = true,
  }: { extraItems?: MenuItem[]; showTreeToggle?: boolean } = {},
): MenuItem {
  return {
    label: 'Clustering',
    icon: AccountTreeIcon,
    type: 'subMenu',
    subMenu: [
      runItem,
      ...extraItems,
      ...(showTreeToggle
        ? [
            {
              label: 'Show tree',
              type: 'checkbox' as const,
              checked: self.showTree,
              disabled: !self.clusterTree,
              disabledHelpText: 'Run clustering first',
              onClick: () => {
                self.setShowTree(!self.showTree)
              },
            },
          ]
        : []),
      treeBranchLengthMenuItem(self),
      ...(self.subtreeFilter?.length
        ? [
            {
              label: 'Clear subtree filter',
              onClick: () => {
                self.setSubtreeFilter(undefined)
              },
            },
          ]
        : []),
    ],
  }
}
