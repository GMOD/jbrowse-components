import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'
import { makeRadioSubMenu } from '@jbrowse/wiggle-core'

import { DEFAULTS } from './displayDefaults.ts'
import { ROW_IDENTITY_MODES } from './rowIdentityModes.ts'

import type { RowIdentityModeWithOff } from './rowIdentityModes.ts'
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
  showConservation: boolean
  showAnnotations: boolean
  showTranslation: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  rowIdentityMode: RowIdentityModeWithOff
  rowIdentityAutoZoom: boolean
  rowHeightMode: number
  subtreeFilter?: readonly string[]
  editableSources?: MafSource[]
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
  setRowProportion: (n: number) => void
  setShowAllLetters: (f: boolean) => void
  setMismatchRendering: (f: boolean) => void
  setShowAsUpperCase: (f: boolean) => void
  setShowTree: (f: boolean) => void
  setShowBranchLength: (f: boolean) => void
  setShowCoverage: (f: boolean) => void
  setShowAlignments: (f: boolean) => void
  setShowConservation: (f: boolean) => void
  setShowAnnotations: (f: boolean) => void
  setShowTranslation: (f: boolean) => void
  setRowIdentityMode: (m: RowIdentityModeWithOff) => void
  setRowIdentityAutoZoom: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  // Consumed structurally by SetRowArrangementDialog's TreeLayoutModel<MafSource>
  // prop (model={self}), not directly in this file.
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
          label: 'Fit to display height',
          type: 'checkbox',
          checked: self.rowHeightMode === 0,
          onClick: () => {
            self.setFitToHeight()
          },
        },
        {
          label: 'Normal',
          onClick: () => {
            self.setRowHeight(DEFAULTS.rowHeight)
            self.setRowProportion(DEFAULTS.rowProportion)
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
          label: 'Show letters at all positions',
          type: 'checkbox',
          checked: self.showAllLetters,
          onClick: () => {
            self.setShowAllLetters(!self.showAllLetters)
          },
        },
        {
          label: 'Show mismatches colored by base',
          type: 'checkbox',
          checked: self.mismatchRendering,
          onClick: () => {
            self.setMismatchRendering(!self.mismatchRendering)
          },
        },
        {
          label: 'Show letters as uppercase',
          type: 'checkbox',
          checked: self.showAsUpperCase,
          onClick: () => {
            self.setShowAsUpperCase(!self.showAsUpperCase)
          },
        },
        {
          label: 'Show sidebar with tree and labels',
          type: 'checkbox',
          checked: self.showTree,
          onClick: () => {
            self.setShowTree(!self.showTree)
          },
        },
        treeBranchLengthMenuItem(self),
        {
          label: 'Show coverage',
          type: 'checkbox',
          checked: self.showCoverage,
          onClick: () => {
            self.setShowCoverage(!self.showCoverage)
          },
        },
        {
          label: 'Show alignments',
          type: 'checkbox',
          checked: self.showAlignments,
          onClick: () => {
            self.setShowAlignments(!self.showAlignments)
          },
        },
        {
          label: 'Show conservation (% identity)',
          type: 'checkbox',
          checked: self.showConservation,
          onClick: () => {
            self.setShowConservation(!self.showConservation)
          },
        },
        ...(self.annotationAdapterConfig
          ? [
              {
                label: 'Show CDS frames',
                type: 'checkbox' as const,
                checked: self.showAnnotations,
                onClick: () => {
                  self.setShowAnnotations(!self.showAnnotations)
                },
              },
              {
                label: 'Show translation (amino acids)',
                type: 'checkbox' as const,
                checked: self.showTranslation,
                onClick: () => {
                  self.setShowTranslation(!self.showTranslation)
                },
              },
            ]
          : []),
        makeRadioSubMenu({
          label: 'Per-row identity',
          value: self.rowIdentityMode,
          onChange: m => {
            self.setRowIdentityMode(m)
          },
          options: ROW_IDENTITY_MODES,
          extraItems: [
            {
              label: 'Auto-switch by zoom',
              type: 'checkbox',
              checked: self.rowIdentityAutoZoom,
              disabled: self.rowIdentityMode === 'none',
              onClick: () => {
                self.setRowIdentityAutoZoom(!self.rowIdentityAutoZoom)
              },
            },
          ],
        }),
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
