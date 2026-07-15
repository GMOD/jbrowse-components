import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import HeightIcon from '@mui/icons-material/Height'

import { radioSubMenu } from '../LinearBasicDisplay/baseModelHelpers.ts'

import type { LegendEntry } from './rendering/colorLegend.ts'
import type { MultiRowSource } from './sourcesLogic.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)

// Preset pixel row heights for the "Row height" menu (0 = auto-fit, handled
// separately). The read (which preset is checked) and the write (setRowHeight)
// must agree, so they share these.
const ROW_HEIGHT_NORMAL = 14
const ROW_HEIGHT_COMPACT = 8

interface MultiRowMenuSelf extends IAnyStateTreeNode {
  showTree: boolean
  showLegend: boolean
  colorLegend: LegendEntry[]
  hiddenCategories: readonly string[]
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  subtreeFilter?: readonly string[]
  editableSources: MultiRowSource[]
  sourcesWithoutLayout: MultiRowSource[]
  clusterTree?: string
  runClustering?: boolean
  rowHeightSetting: number
  setShowTree: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  toggleCategory: (label: string) => void
  setShowBranchLength: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  setLayout: (s: MultiRowSource[]) => void
  clearLayout: () => void
  willClearTree: (s: MultiRowSource[]) => boolean
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
  setRunClustering: (arg?: boolean) => void
}

export function buildMultiRowTrackMenuItems(
  self: MultiRowMenuSelf,
): MenuItem[] {
  const rowHeightChoice =
    self.rowHeightSetting === 0
      ? 'fit'
      : self.rowHeightSetting === ROW_HEIGHT_NORMAL
        ? 'normal'
        : self.rowHeightSetting === ROW_HEIGHT_COMPACT
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
    ...(self.colorLegend.length
      ? [
          {
            label: 'Show color legend',
            type: 'checkbox' as const,
            checked: self.showLegend,
            onClick: () => {
              self.setShowLegend(!self.showLegend)
            },
          },
          {
            label: 'Categories',
            subMenu: self.colorLegend.map(entry => ({
              label: entry.label,
              type: 'checkbox' as const,
              checked: !self.hiddenCategories.includes(entry.label),
              onClick: () => {
                self.toggleCategory(entry.label)
              },
            })),
          },
        ]
      : []),
    {
      icon: HeightIcon,
      ...radioSubMenu(
        'Row height',
        rowHeightChoice,
        [
          { value: 'fit', label: 'Squeeze to fit view' },
          { value: 'normal', label: 'Normal' },
          { value: 'compact', label: 'Compact' },
        ],
        value => {
          if (value === 'fit') {
            self.setFitToHeight()
          } else {
            self.setRowHeight(
              value === 'compact' ? ROW_HEIGHT_COMPACT : ROW_HEIGHT_NORMAL,
            )
          }
        },
      ),
    },
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
    {
      label: 'Cluster rows by similarity',
      icon: AccountTreeIcon,
      disabled: self.sourcesWithoutLayout.length < 2 || !!self.runClustering,
      disabledHelpText:
        self.sourcesWithoutLayout.length < 2
          ? 'Needs at least two rows to cluster'
          : 'Clustering…',
      onClick: () => {
        self.setRunClustering(true)
      },
    },
    ...(self.clusterTree
      ? [
          {
            label: 'Clear clustering (reset row order)',
            onClick: () => {
              self.clearLayout()
            },
          },
        ]
      : []),
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
