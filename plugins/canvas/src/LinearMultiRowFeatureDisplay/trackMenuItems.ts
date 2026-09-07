import { lazy } from 'react'

import { undoItems } from '@jbrowse/core/ui/filterMenuItems'
import { checkboxItem, radioItems, withHint } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import LegendToggleIcon from '@mui/icons-material/LegendToggle'
import TableRowsIcon from '@mui/icons-material/TableRows'

import { partitionRowCountHint } from './partitionFields.ts'

import type { PartitionRowCount } from './partitionFields.ts'
import type { LegendEntry } from './rendering/colorLegend.ts'
import type { MultiRowSource } from './rowSources.ts'
import type { MultiRowClusterDialogModel } from './runMultiRowClustering.ts'
import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)
const MultiRowClusterDialog = lazy(
  () => import('./components/MultiRowClusterDialog.tsx'),
)

const ROW_HEIGHT_PRESETS = [
  { label: 'Normal', rowHeight: 14 },
  { label: 'Compact', rowHeight: 8 },
]

interface MultiRowMenuSelf
  extends
    IStateTreeNode,
    TreeLayoutModel<MultiRowSource>,
    MultiRowClusterDialogModel {
  showTree: boolean
  showLegend: boolean
  showLegendDisplayTypeDefault: Pin
  showRowSeparators: boolean
  showRowLabels: boolean
  setShowRowLabels: (f: boolean) => void
  colorRowLabels: boolean
  setColorRowLabels: (f: boolean) => void
  effectiveRowHeight: number
  colorLegend: LegendEntry[]
  // Reads "has a key at all", not "one is drawn right now": a configured key
  // waiting on its first fetch still owns the toggle.
  hasLegendKey: boolean
  hiddenCategories: readonly string[]
  hiddenCategorySet: ReadonlySet<string>
  effectivePartitionField: string
  partitionCandidates: string[]
  partitionRowCounts: ReadonlyMap<string, PartitionRowCount>
  setPartitionField: (field: string) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  subtreeFilter?: readonly string[]
  layout: readonly MultiRowSource[]
  rowOrderIsCustom: boolean
  // Narrowed from TreeLayoutModel's optional: this menu gates on its length.
  editableSources: MultiRowSource[]
  clusterTree?: string
  rowHeight: number
  setShowTree: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowRowSeparators: (f: boolean) => void
  toggleCategory: (label: string) => void
  setHiddenCategories: (labels: string[]) => void
  setShowBranchLength: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
}

function showMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  return [
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    // Gated on both keys: the row-group key ordinarily draws on a track whose
    // `colorLegend` is empty, and gating on `colorLegend` alone leaves a user
    // who dismissed the group key with no item to bring it back.
    ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
    showRowSeparatorsMenuItem(self),
    // Only while the labels are on, since with them hidden this tints nothing.
    ...(self.showRowLabels
      ? [
          checkboxItem(
            'Color row labels by row color',
            self.colorRowLabels,
            () => {
              self.setColorRowLabels(!self.colorRowLabels)
            },
          ),
        ]
      : []),
  ]
}

function multiRowNarrowings(self: MultiRowMenuSelf): Reversibles {
  return {
    hiddenCategories: {
      count: self.hiddenCategories.length,
      label: () => 'Show all categories',
      clear: () => {
        self.setHiddenCategories([])
      },
    },
  }
}

// The submenu survives an empty legend as long as anything is hidden:
// `buildColorLegend` gives up past MAX_LEGEND_ENTRIES distinct colors, and
// `hiddenCategories` stays in the session and re-applies when the count drops
// back, so without this the hiding would have no visible cause and no way out.
function categoriesMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const hidden = self.hiddenCategories.length
  const hiddenSet = self.hiddenCategorySet
  const toggles = self.colorLegend.map(entry =>
    checkboxItem(entry.label, !hiddenSet.has(entry.label), () => {
      self.toggleCategory(entry.label)
    }),
  )
  return toggles.length || hidden
    ? [
        {
          label: hidden ? `Categories (${hidden} hidden)` : 'Categories',
          icon: LegendToggleIcon,
          subMenu: [...toggles, ...undoItems(multiRowNarrowings(self))],
        },
      ]
    : []
}

// The radio reads `effectivePartitionField` because the checked row is often
// one no config names, and its options are discovered off the loaded features'
// own attribute names. A `jexl:` partition checks none of the radios and gets a
// disabled row naming it; nothing here can write one, since a menu that could
// clear an expression but not restore it would be a one-way door.
function partitionMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const { partitionCandidates, partitionRowCounts, effectivePartitionField } =
    self
  if (!partitionCandidates.length) {
    return []
  }
  const isExpression = effectivePartitionField.startsWith('jexl:')
  return [
    {
      label: 'Partition by...',
      icon: TableRowsIcon,
      subMenu: [
        ...(isExpression
          ? [{ label: 'Custom expression', disabled: true, onClick: () => {} }]
          : []),
        ...radioItems(
          partitionCandidates.map(value => ({
            value,
            label: withHint(
              value,
              partitionRowCountHint(partitionRowCounts.get(value)),
            ),
          })),
          isExpression ? undefined : effectivePartitionField,
          (field: string) => {
            self.setPartitionField(field)
          },
        ),
      ],
    },
  ]
}

export function buildMultiRowTrackMenuItems(
  self: MultiRowMenuSelf,
): MenuItem[] {
  return [
    ...makeShowSubMenu(showMenuItems(self)),
    rowHeightMenuItem(self, ROW_HEIGHT_PRESETS),
    ...partitionMenuItems(self),
    ...categoriesMenuItems(self),
    rowArrangementMenuItem({
      ready: !!self.editableSources.length,
      onOpen: () => {
        getDialogHost(self).queueDialog(handleClose => [
          SetRowArrangementDialog,
          { model: self, handleClose },
        ])
      },
    }),
    // Top-level, since clustering is only one of the three things writing
    // `layout`.
    ...resetRowOrderMenuItems(self),
    clusteringMenuItem(
      self,
      {
        label: 'Cluster rows by similarity...',
        onClick: () => {
          getDialogHost(self).queueDialog(handleClose => [
            MultiRowClusterDialog,
            { model: self, handleClose },
          ])
        },
      },
      self.clusterableSources.length,
    ),
  ]
}
