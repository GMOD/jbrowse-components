import { lazy } from 'react'

import { undoItems } from '@jbrowse/core/ui/filterMenuItems'
import {
  checkboxItem,
  radioItems,
  showLegendCheckboxItem,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
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

// Preset pixel row heights for the shared "Row height" menu (the fit sentinel
// and the "Custom..." dialog are its, not ours). The read (which preset is
// checked) and the write (setRowHeight) both go through this table.
const ROW_HEIGHT_PRESETS = [
  { label: 'Normal', rowHeight: 14 },
  { label: 'Compact', rowHeight: 8 },
]

// The four row-arrangement members are inherited from `TreeLayoutModel` rather
// than re-declared: they exist here only because `rowArrangementMenuItem` hands
// this same `self` to SetRowArrangementDialog, so the dialog's own contract is
// what they have to satisfy. Spelled out locally they were a second copy of it,
// free to drift from the thing actually type-checking the dialog call.
interface MultiRowMenuSelf
  extends
    IStateTreeNode,
    TreeLayoutModel<MultiRowSource>,
    // what the cluster dialog reads and writes, so the menu's `self` satisfies
    // the dialog's `model` where it hands it over
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
  // covers the display's other color key too (see `rowGroupLegend`) — not
  // toggleable per-category, but under the same `showLegend` slot, so the "Show
  // legend" item has to see it. The "has one at all" reading rather than the
  // "one is drawn right now" one: a configured key waiting on its first fetch,
  // or standing behind the density band, still owns the toggle.
  hasLegendKey: boolean
  hiddenCategories: readonly string[]
  // the model's derived Set of the above, which is where every other consumer
  // asks whether a category is hidden — the checkbox below has to agree with the
  // legend row it mirrors, so it reads the same derivation rather than its own
  hiddenCategorySet: ReadonlySet<string>
  // which attribute assigns a feature to a row, and the names the loaded
  // features actually carry — the menu offers the second and writes the first
  effectivePartitionField: string
  partitionCandidates: string[]
  setPartitionField: (field: string) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  subtreeFilter?: readonly string[]
  layout: readonly MultiRowSource[]
  rowOrderIsCustom: boolean
  // narrowed from TreeLayoutModel's optional: `rowArrangementMenuItem` gates on
  // its length, so this menu needs it to be there
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
    // Both keys, because `showLegend` governs both and the legend's own "×"
    // writes it: the row-group key draws on a track whose `colorLegend` is
    // empty — that is its ordinary case, since every row carrying a per-row
    // color is exactly what makes `buildColorLegend` return nothing — so
    // gating on `colorLegend` alone let a user dismiss the group key with no
    // menu item left to bring it back.
    ...(self.hasLegendKey
      ? [
          showLegendCheckboxItem(
            self.showLegend,
            () => {
              self.setShowLegend(!self.showLegend)
            },
            { pin: self.showLegendDisplayTypeDefault },
          ),
        ]
      : []),
    showRowSeparatorsMenuItem(self),
    // Sits under the labels toggle it depends on, and only while they are on:
    // with the labels hidden this tints nothing (SvgRowLabels' swatch stripe
    // reads `labelColor` too, but only where the labels themselves have been
    // dropped for height, which is a different question than this toggle asks).
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

// What this display hides, declared once (see `Reversible`). Only the category
// set for now — `subtreeFilter` is tree-sidebar's and carries its own row
// (`clearSubtreeFilterMenuItems`).
//
// This display has no "Filter by... (n)" family to fold these into, so nothing
// counts them out loud: a track with categories hidden says so only through the
// legend's dimmed rows and the "Categories (n hidden)" label. Declaring them
// here is what would make a count possible if that is ever wanted; today it just
// single-sources the row below.
function multiRowNarrowings(self: MultiRowMenuSelf): Reversibles {
  return {
    hiddenCategories: {
      count: self.hiddenCategories.length,
      // The only recovery once the legend — where hidden categories render
      // dimmed — has been dismissed, and the only one at all when the legend is
      // gone entirely (see categoriesMenuItems).
      label: () => 'Show all categories',
      clear: () => {
        self.setHiddenCategories([])
      },
    },
  }
}

// Per-category visibility. Stays its own submenu rather than folding into
// "Show..." because a chromHMM painting has 15-25 states; the on-screen legend
// truncates to what fits the track and delegates the full list here.
//
// The submenu survives an empty legend as long as anything is hidden, and that
// case is real rather than defensive: `buildColorLegend` gives up entirely past
// MAX_LEGEND_ENTRIES distinct colors, so a region loading in and pushing a
// 29-color painting to 31 takes the whole color key away — and with it the
// toggles, while `hiddenCategories` stays in the session and re-applies the
// moment the count drops back. Hiding then had no visible cause and no way out.
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

// Which attribute assigns a feature to a row — the one thing the whole display
// is built on that had no way in from the UI. Picking the display type from
// "Display types" left `partitionField` at its `name` default, which on
// RepeatMasker is one row per repeat: thousands of hairlines, and no menu item
// anywhere to say what a reader was supposed to do about it. The default now
// picks off the data instead (`resolvePartitionField`), which is why the radio
// reads `effectivePartitionField` — the checked row is often one no config
// names.
//
// The options are DISCOVERED, off the loaded features' own attribute names
// (`partitionCandidates`), the same way the rows are. So a file gains a column
// and the menu offers it with no config change, and a track whose data has not
// loaded offers nothing rather than a stale list.
//
// A `jexl:` partition — the recipe for a file that carries its category inside
// another column, see makeFeaturePartitionResolver — checks none of the radios,
// and gets a disabled row naming it rather than being silently unrepresented.
// Nothing here can write one: an expression is a config-level thing, and a menu
// that could clear it but not restore it would be a one-way door.
function partitionMenuItems(self: MultiRowMenuSelf): MenuItem[] {
  const { partitionCandidates, effectivePartitionField } = self
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
          partitionCandidates.map(value => ({ value, label: value })),
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
    // top-level rather than nested under "Clustering", which is only one of the
    // three things that write `layout` — see resetRowOrderMenuItems
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
