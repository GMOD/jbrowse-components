import { lazy } from 'react'

import { undoItems } from '@jbrowse/core/ui/filterMenuItems'
import { checkboxItem, radioItems, withHint } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { groupByRadioMenuItem } from '@jbrowse/display-kit/groupByMenu'
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

import { entryHidden } from './rendering/colorLegend.ts'
import { ROW_HEIGHT_PRESETS } from './rowHeightPresets.ts'
import { rowCountHint } from './rowsFields.ts'

import type { LegendEntry } from './rendering/colorLegend.ts'
import type { RowCountByField } from './rowsFields.ts'
import type { MultiRowClusterDialogModel } from './runMultiRowClustering.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { RowSource, TreeLayoutModel } from '@jbrowse/tree-sidebar'

const MultiRowClusterDialog = lazy(
  () => import('./components/MultiRowClusterDialog.tsx'),
)

interface MultiRowMenuSelf
  extends
    IStateTreeNode,
    TreeLayoutModel<RowSource>,
    MultiRowClusterDialogModel {
  showTree: boolean
  showLegend: boolean
  showRowSeparators: boolean
  showRowLabels: boolean
  setShowRowLabels: (f: boolean) => void
  effectiveRowHeight: number
  colorLegend: LegendEntry[]
  // Reads "has a key at all", not "one is drawn right now": a configured key
  // waiting on its first fetch still owns the toggle.
  hasLegendKey: boolean
  hiddenCategories: readonly string[]
  hiddenCategorySet: ReadonlySet<string>
  effectiveRowsField: string
  rowsFieldCandidates: string[]
  rowCountsByField: ReadonlyMap<string, RowCountByField>
  setRowsField: (field: string) => void
  facet?: FacetSetting
  rowColorFields: readonly string[]
  setFacet: (facet?: { field: string }) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  rowFocus?: readonly string[]
  rowArrangementIsCustom: boolean
  rowTree?: string
  rowHeight: number
  setShowTree: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowRowSeparators: (f: boolean) => void
  toggleCategory: (values: readonly string[]) => void
  setHiddenCategories: (labels: string[]) => void
  setShowBranchLength: (f: boolean) => void
  setRowFocus: (names?: readonly string[]) => void
  setScrollTop: (scrollTop: number) => void
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
    checkboxItem(entry.label, !entryHidden(entry, hiddenSet), () => {
      self.toggleCategory(entry.values)
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

// The radio reads `effectiveRowsField` because the checked row is often
// one no config names, and its options are discovered off the loaded features'
// own attribute names. A `jexl:` partition checks none of the radios and gets a
// disabled row naming it; nothing here can write one, since a menu that could
// clear an expression but not restore it would be a one-way door.
function rowsFieldMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const { rowsFieldCandidates, rowCountsByField, effectiveRowsField } = self
  if (!rowsFieldCandidates.length) {
    return []
  }
  const isExpression = effectiveRowsField.startsWith('jexl:')
  return [
    {
      label: 'One row per...',
      icon: TableRowsIcon,
      subMenu: [
        ...(isExpression
          ? [{ label: 'Custom expression', disabled: true, onClick: () => {} }]
          : []),
        ...radioItems(
          rowsFieldCandidates.map(value => ({
            value,
            label: withHint(value, rowCountHint(rowCountsByField.get(value))),
          })),
          isExpression ? undefined : effectiveRowsField,
          (field: string) => {
            self.setRowsField(field)
          },
        ),
      ],
    },
  ]
}

// The facet's own field stays a radio while no row carries it, so a config's
// `facet: 'group'` reads checked before the rows load.
function groupByMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const current = self.facet?.field
  const fields =
    current === undefined || self.rowColorFields.includes(current)
      ? self.rowColorFields
      : [...self.rowColorFields, current]
  return fields.length
    ? [
        groupByRadioMenuItem({
          current,
          options: fields.map(field => ({ type: field, label: field })),
          onSelect: field => {
            self.setFacet({ field })
          },
          onNone: () => {
            self.setFacet(undefined)
          },
        }),
      ]
    : []
}

export function buildMultiRowTrackMenuItems(
  self: MultiRowMenuSelf,
): MenuItem[] {
  return [
    ...makeShowSubMenu(showMenuItems(self)),
    rowHeightMenuItem(self, ROW_HEIGHT_PRESETS),
    ...rowsFieldMenuItems(self),
    ...groupByMenuItems(self),
    ...categoriesMenuItems(self),
    rowArrangementMenuItem(self, { ready: !!self.editableSources.length }),
    // Top-level, since clustering is only one of the three things writing
    // `rows.domain`.
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
