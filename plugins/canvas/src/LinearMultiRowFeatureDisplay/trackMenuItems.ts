import { lazy } from 'react'

import { checkboxItem, radioItems } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  clusteringMenuItem,
  treeBranchLengthMenuItem,
} from '@jbrowse/tree-sidebar'
import HeightIcon from '@mui/icons-material/Height'
import LegendToggleIcon from '@mui/icons-material/LegendToggle'
import PaletteIcon from '@mui/icons-material/Palette'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import VisibilityIcon from '@mui/icons-material/Visibility'

import type { LegendEntry } from './rendering/colorLegend.ts'
import type { MultiRowSource } from './sourcesLogic.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)
const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog.tsx'),
)

// Preset pixel row heights for the "Row height" menu (0 = auto-fit, handled
// separately). The read (which preset is checked) and the write (setRowHeight)
// must agree, so they share these.
const ROW_HEIGHT_NORMAL = 14
const ROW_HEIGHT_COMPACT = 8

const ROW_HEIGHT_PRESETS = [
  { value: 'fit', label: 'Squeeze to fit view' },
  { value: 'normal', label: 'Normal' },
  { value: 'compact', label: 'Compact' },
] as const

// Which preset the current setting is, or undefined for a hand-entered height
// (the "Custom..." row). `rowHeight` is one coupled axis — 0 is the fit-to-view
// sentinel, any positive value a pinned px height — so these are radios.
function rowHeightPreset(rowHeightSetting: number) {
  return rowHeightSetting === 0
    ? 'fit'
    : rowHeightSetting === ROW_HEIGHT_NORMAL
      ? 'normal'
      : rowHeightSetting === ROW_HEIGHT_COMPACT
        ? 'compact'
        : undefined
}

interface MultiRowMenuSelf extends IAnyStateTreeNode {
  showTree: boolean
  showLegend: boolean
  colorLegend: LegendEntry[]
  hiddenCategories: readonly string[]
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  subtreeFilter?: readonly string[]
  layout: readonly MultiRowSource[]
  editableSources: MultiRowSource[]
  sourcesWithoutLayout: MultiRowSource[]
  clusterTree?: string
  runClustering?: boolean
  rowHeightSetting: number
  setShowTree: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  toggleCategory: (label: string) => void
  setHiddenCategories: (labels: string[]) => void
  setShowBranchLength: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  setLayout: (s: MultiRowSource[]) => void
  clearLayout: () => void
  willClearTree: (s: MultiRowSource[]) => boolean
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
  setRunClustering: (arg?: boolean) => void
}

// The sidebar toggle shows row labels with or without a tree, so it lives here
// rather than under "Clustering" (which opts out of both its tree controls —
// see the treeApplies: false below), and the branch-length toggle follows it so
// the two tree controls sit together.
function showMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  return [
    checkboxItem('Show sidebar with tree and labels', self.showTree, () => {
      self.setShowTree(!self.showTree)
    }),
    ...(self.colorLegend.length
      ? [
          checkboxItem('Show legend', self.showLegend, () => {
            self.setShowLegend(!self.showLegend)
          }),
        ]
      : []),
    treeBranchLengthMenuItem(self),
  ]
}

function rowHeightMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const preset = rowHeightPreset(self.rowHeightSetting)
  return [
    ...radioItems(ROW_HEIGHT_PRESETS, preset, value => {
      if (value === 'fit') {
        self.setFitToHeight()
      } else {
        self.setRowHeight(
          value === 'compact' ? ROW_HEIGHT_COMPACT : ROW_HEIGHT_NORMAL,
        )
      }
    }),
    // written out rather than going through radioItems because a dialog opener
    // dismisses the menu instead of keeping it open
    {
      label: 'Custom...',
      type: 'radio',
      checked: preset === undefined,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          SetRowHeightDialog,
          { model: self, handleClose },
        ])
      },
    },
  ]
}

// Per-category visibility. Stays its own submenu rather than folding into
// "Show..." because a chromHMM painting has 15-25 states; the on-screen legend
// truncates to what fits the track and delegates the full list here.
function categoriesMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const hidden = self.hiddenCategories.length
  return self.colorLegend.length
    ? [
        {
          label: hidden ? `Categories (${hidden} hidden)` : 'Categories',
          icon: LegendToggleIcon,
          subMenu: [
            ...self.colorLegend.map(entry =>
              checkboxItem(
                entry.label,
                !self.hiddenCategories.includes(entry.label),
                () => {
                  self.toggleCategory(entry.label)
                },
              ),
            ),
            // the only recovery once the legend (where hidden rows render
            // dimmed) has been dismissed
            ...(hidden
              ? [
                  {
                    label: 'Show all categories',
                    onClick: () => {
                      self.setHiddenCategories([])
                    },
                  },
                ]
              : []),
          ],
        },
      ]
    : []
}

export function buildMultiRowTrackMenuItems(
  self: MultiRowMenuSelf,
): MenuItem[] {
  return [
    {
      label: 'Show...',
      icon: VisibilityIcon,
      type: 'subMenu',
      subMenu: showMenuItems(self),
    },
    {
      label: 'Row height',
      icon: HeightIcon,
      type: 'subMenu',
      subMenu: rowHeightMenuItems(self),
    },
    ...categoriesMenuItems(self),
    {
      label: 'Edit colors/arrangement...',
      icon: PaletteIcon,
      disabled: !self.editableSources.length,
      disabledHelpText: 'Loading rows...',
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          SetRowArrangementDialog,
          { model: self, handleClose },
        ])
      },
    },
    // Top-level rather than nested under "Clustering" (where the other
    // clusterable displays keep theirs) because all three ways of reordering
    // rows land in `layout`: clustering, the arrangement dialog, and the
    // right-click sort. Only the first leaves a `clusterTree`, so a
    // clustering-gated item left a dialog reorder undoable from the dialog
    // alone.
    ...(self.layout.length
      ? [
          {
            label: 'Reset row order',
            icon: RestartAltIcon,
            onClick: () => {
              self.clearLayout()
            },
          },
        ]
      : []),
    clusteringMenuItem(
      self,
      {
        label: 'Cluster rows by similarity',
        disabled: self.sourcesWithoutLayout.length < 2 || !!self.runClustering,
        disabledHelpText:
          self.sourcesWithoutLayout.length < 2
            ? 'Needs at least two rows to cluster'
            : 'Clustering…',
        onClick: () => {
          self.setRunClustering(true)
        },
      },
      // Both tree controls (show the tree, branch lengths) live under
      // "Show..." for this display, so Clustering contributes neither —
      // showTreeToggle alone left "Tree branch lengths" in both submenus.
      { treeApplies: false },
    ),
  ]
}
