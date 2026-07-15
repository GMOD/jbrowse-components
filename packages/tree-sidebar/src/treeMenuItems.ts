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
