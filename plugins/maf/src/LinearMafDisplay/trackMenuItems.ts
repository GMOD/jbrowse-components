import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'

import type { MafSource } from './stateModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog/SetRowHeightDialog.tsx'),
)
const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)

interface MafMenuSelf extends IAnyStateTreeNode {
  showAllLetters: boolean
  mismatchRendering: boolean
  showAsUpperCase: boolean
  showTree: boolean
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showCoverage: boolean
  showAlignments: boolean
  subtreeFilter?: readonly string[]
  editableSources?: MafSource[]
  clusterTree?: string
  setRowHeight: (n: number) => void
  setRowProportion: (n: number) => void
  setShowAllLetters: (f: boolean) => void
  setMismatchRendering: (f: boolean) => void
  setShowAsUpperCase: (f: boolean) => void
  setShowTree: (f: boolean) => void
  setShowBranchLength: (f: boolean) => void
  setShowCoverage: (f: boolean) => void
  setShowAlignments: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  setLayout: (s: MafSource[]) => void
  clearLayout: () => void
  willClearTree: (s: MafSource[]) => boolean
}

export function buildMafTrackMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    {
      label: 'Set feature height',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Normal',
          onClick: () => {
            self.setRowHeight(15)
            self.setRowProportion(0.8)
          },
        },
        {
          label: 'Compact',
          onClick: () => {
            self.setRowHeight(8)
            self.setRowProportion(0.9)
          },
        },
        {
          label: 'Manually set height',
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              SetRowHeightDialog,
              { model: self, handleClose },
            ])
          },
        },
      ],
    },
    {
      label: 'Show...',
      type: 'subMenu',
      subMenu: [
        {
          label: 'Letters at all positions',
          type: 'checkbox',
          checked: self.showAllLetters,
          onClick: () => {
            self.setShowAllLetters(!self.showAllLetters)
          },
        },
        {
          label: 'Mismatches colored by base',
          type: 'checkbox',
          checked: self.mismatchRendering,
          onClick: () => {
            self.setMismatchRendering(!self.mismatchRendering)
          },
        },
        {
          label: 'Letters as uppercase',
          type: 'checkbox',
          checked: self.showAsUpperCase,
          onClick: () => {
            self.setShowAsUpperCase(!self.showAsUpperCase)
          },
        },
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
          label: 'Coverage',
          type: 'checkbox',
          checked: self.showCoverage,
          onClick: () => {
            self.setShowCoverage(!self.showCoverage)
          },
        },
        {
          label: 'Alignments',
          type: 'checkbox',
          checked: self.showAlignments,
          onClick: () => {
            self.setShowAlignments(!self.showAlignments)
          },
        },
      ],
    },
    {
      label: 'Edit row arrangement...',
      disabled: !self.editableSources?.length,
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
