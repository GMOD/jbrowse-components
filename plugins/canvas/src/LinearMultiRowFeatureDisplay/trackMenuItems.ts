import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'

import type { MultiRowSource } from './sourcesLogic.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)

interface MultiRowMenuSelf extends IAnyStateTreeNode {
  showTree: boolean
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  subtreeFilter?: readonly string[]
  editableSources: MultiRowSource[]
  clusterTree?: string
  rowHeightSetting: number
  setShowTree: (f: boolean) => void
  setShowBranchLength: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  setLayout: (s: MultiRowSource[]) => void
  clearLayout: () => void
  willClearTree: (s: MultiRowSource[]) => boolean
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
}

export function buildMultiRowTrackMenuItems(
  self: MultiRowMenuSelf,
): MenuItem[] {
  return [
    {
      label: 'Sidebar with tree and labels',
      type: 'checkbox',
      checked: self.showTree,
      onClick: () => {
        self.setShowTree(!self.showTree)
      },
    },
    treeBranchLengthMenuItem(self),
    {
      label: 'Row height',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Auto-fit to display height',
          type: 'checkbox',
          checked: self.rowHeightSetting === 0,
          onClick: () => {
            self.setFitToHeight()
          },
        },
        {
          label: 'Normal',
          onClick: () => {
            self.setRowHeight(14)
          },
        },
        {
          label: 'Compact',
          onClick: () => {
            self.setRowHeight(8)
          },
        },
      ],
    },
    {
      label: 'Edit row arrangement...',
      disabled: !self.editableSources.length,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          SetRowArrangementDialog,
          { model: self, handleClose },
        ])
      },
    },
    ...(self.subtreeFilter
      ? [
          {
            label: 'Clear subtree filter',
            onClick: () => {
              self.setSubtreeFilter(undefined)
            },
          },
        ]
      : []),
  ]
}
