import { lazy } from 'react'

import { undoItems } from '@jbrowse/core/ui/filterMenuItems'
import { checkboxItem, radioItems, withHint } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  colorByMenuItem,
  colorFieldRows,
} from '@jbrowse/display-kit/colorByMenu'
import { groupByRadioMenuItem } from '@jbrowse/display-kit/groupByMenu'
import {
  rowOrderMenuItems,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import LegendToggleIcon from '@mui/icons-material/LegendToggle'
import TableRowsIcon from '@mui/icons-material/TableRows'

import { entryHidden } from './rendering/colorLegend.ts'
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
  activeHiddenCategories: readonly string[]
  hiddenCategorySet: ReadonlySet<string>
  effectiveRowsField: string
  rowsFieldCandidates: string[]
  colorFieldCandidates: string[]
  carriesItemRgb: boolean
  paintsItemRgb: boolean
  colorByItemRgb: () => void
  rowCountsByField: ReadonlyMap<string, RowCountByField>
  setRowsField: (field: string) => void
  facet?: FacetSetting
  rowColorFields: readonly string[]
  facetByField: (field: string) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  rowFocus?: readonly string[]
  rowArrangementIsCustom: boolean
  rowTree?: string
  colorField: string | undefined
  colorByMode: 'default' | 'solid' | 'strand' | 'attribute'
  colorByField: (field: string) => void
  pickDefaultColor: () => void
  pickSolidColor: () => void
  setShowTree: (f: boolean) => void
  setShowLegend: (f: boolean) => void
  setShowRowSeparators: (f: boolean) => void
  toggleCategory: (values: readonly string[]) => void
  setHiddenCategories: (labels: string[]) => void
  setShowBranchLength: (f: boolean) => void
  setRowFocus: (names?: readonly string[]) => void
  setScrollTop: (scrollTop: number) => void
}

function showMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  return [
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    showRowSeparatorsMenuItem(self),
    // Gated on both keys: the row-group key ordinarily draws on a track whose
    // `colorLegend` is empty, and gating on `colorLegend` alone leaves a user
    // who dismissed the group key with no item to bring it back.
    ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
  ]
}

function multiRowNarrowings(self: MultiRowMenuSelf): Reversibles {
  return {
    hiddenCategories: {
      count: self.activeHiddenCategories.length,
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
  const hidden = self.activeHiddenCategories.length
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

// Strand, as the feature display offers it, the file's own colors where the
// features carry a BED color column, then a radio per attribute the loaded
// features carry, the painting field kept among them while no feature carries
// it.
function colorByMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const current = self.colorField
  const candidates = self.colorFieldCandidates
  const fields =
    current === undefined ||
    current === STRAND_FIELD ||
    candidates.includes(current)
      ? candidates
      : [...candidates, current]
  return [
    colorByMenuItem({
      blocks: [
        {
          rows: colorFieldRows(self, [
            {
              label: 'Strand',
              field: STRAND_FIELD,
              checked: self.colorByMode === 'strand',
            },
            ...(self.carriesItemRgb || self.paintsItemRgb
              ? [
                  {
                    label: 'itemRgb',
                    checked: self.paintsItemRgb,
                    onClick: () => {
                      self.colorByItemRgb()
                    },
                  },
                ]
              : []),
            ...fields.map(field => ({
              label: field,
              field,
              checked: current === field,
            })),
          ]),
        },
      ],
    }),
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
            self.facetByField(field)
          },
          onNone: () => {
            self.facetByField('')
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
    ...rowsFieldMenuItems(self),
    ...groupByMenuItems(self),
    ...colorByMenuItems(self),
    ...categoriesMenuItems(self),
    ...rowOrderMenuItems(self, {
      arrangement: { ready: !!self.editableSources.length },
      cluster: {
        runItem: {
          label: 'Cluster rows by similarity...',
          onClick: () => {
            getDialogHost(self).queueDialog(handleClose => [
              MultiRowClusterDialog,
              { model: self, handleClose },
            ])
          },
        },
        rowCount: self.clusterableSources.length,
      },
    }),
  ]
}
