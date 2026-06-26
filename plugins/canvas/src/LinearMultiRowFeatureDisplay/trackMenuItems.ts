import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'

import { radioSubMenu } from '../LinearBasicDisplay/baseModelHelpers.ts'

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
  const rowHeightChoice =
    self.rowHeightSetting === 0
      ? 'fit'
      : self.rowHeightSetting === 14
        ? 'normal'
        : self.rowHeightSetting === 8
          ? 'compact'
          : 'custom'
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
    radioSubMenu(
      'Row height',
      rowHeightChoice,
      [
        { value: 'fit', label: 'Auto-fit to display height' },
        { value: 'normal', label: 'Normal' },
        { value: 'compact', label: 'Compact' },
      ],
      value => {
        if (value === 'fit') {
          self.setFitToHeight()
        } else {
          self.setRowHeight(value === 'compact' ? 8 : 14)
        }
      },
    ),
    {
      label: 'Edit colors/arrangement...',
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
