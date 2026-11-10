import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { checkboxItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import { filterFieldNarrowing } from '@jbrowse/core/util/jexlFilters'
import { MAX_LEGEND_ENTRIES } from '@jbrowse/core/util/legendCandidates'
import { legendMenuItems } from '@jbrowse/display-kit/LegendMixin'
import {
  hiddenGroupsItems,
  resetSectionOrderItems,
} from '@jbrowse/display-kit/groupByMenu'
import { editPlotMenuItems } from '@jbrowse/display-kit/plotMenu'
import {
  resetRowOrderMenuItems,
  rowOrderMenuItems,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  showRowSeparatorsMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import { makeScoreAxisMenuItem } from '@jbrowse/wiggle-core'
import { makeMarkSizeSubMenu } from '@jbrowse/wiggle-core/chrome'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LegendToggleIcon from '@mui/icons-material/LegendToggle'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import { hitLocString } from './findMarkHit.ts'
import { markColorScales } from './legend.ts'
import {
  DEFAULT_POINT_DIAMETER_PX,
  NORMAL_ROW_PROPORTION,
} from './markVocabulary.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RowHeightPreset } from '@jbrowse/tree-sidebar'

const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))
const MarkClusterDialog = lazy(
  () => import('./components/MarkClusterDialog.tsx'),
)

const ROW_HEIGHT_PRESETS: RowHeightPreset[] = [
  { label: 'Normal', rowHeight: 15, rowProportion: NORMAL_ROW_PROPORTION },
  { label: 'Compact', rowHeight: 8, rowProportion: 0.9 },
]

function rowsMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  return [
    rowHeightMenuItem(self, ROW_HEIGHT_PRESETS),
    ...rowOrderMenuItems(self, {
      arrangement: { ready: self.editableSources.length > 0 },
      cluster: {
        runItem: {
          label: 'Cluster rows by similarity...',
          disabled: self.rowCompare === undefined,
          disabledHelpText: 'No bar, point or rect mark draws at this zoom',
          onClick: () => {
            getDialogHost(self).queueDialog(handleClose => [
              MarkClusterDialog,
              { model: self, handleClose },
            ])
          },
        },
        rowCount: self.clusterableSources.length,
      },
    }),
  ]
}

// One checkbox per row of each categorical or identity color key, which
// hides the row's categories from the plot and the hover. A key too long to
// list offers no submenu; "Show all categories" under Filter by undoes its
// hides.
function categoriesMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  const rows = self.legendSections.flatMap(section => {
    const { scale } = section
    if (
      section.channel !== 'color' ||
      (scale.kind !== 'categorical' && scale.kind !== 'identity')
    ) {
      return []
    }
    const field = scale.kind === 'identity' ? '' : scale.field
    return markColorScales([section]).flatMap(key =>
      key.kind === 'categorical'
        ? key.entries.map(entry => ({ field, entry }))
        : [],
    )
  })
  const hidden = self.activeHiddenCategories.length
  return rows.length > 0 && rows.length <= MAX_LEGEND_ENTRIES
    ? [
        {
          label: hidden > 0 ? `Categories (${hidden} hidden)` : 'Categories',
          icon: LegendToggleIcon,
          subMenu: rows.map(({ field, entry }) =>
            checkboxItem(entry.label, !entry.hidden, () => {
              self.toggleCategory(field, entry.values ?? [entry.value])
            }),
          ),
        },
      ]
    : []
}

function pinDistinctShapesMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  return self.sharedKeys.length > 0
    ? [
        {
          label: 'Pin distinct shapes',
          onClick: () => {
            self.pinDistinctShapes()
          },
        },
      ]
    : []
}

/** The track menu: the mark form, the axis, the filter, the sections and rows, the chrome toggles, and the plot as text. */
export function markTrackMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  return [
    {
      label: 'Edit marks...',
      icon: ShowChartIcon,
      onClick: () => {
        self.openMarkPlotDialog()
      },
    },
    makeScoreAxisMenuItem(self),
    ...makeMarkSizeSubMenu({
      label: 'Point size',
      applies: self.hasPointMark,
      value: () => self.pointSize,
      isDefault: self.pointSize === DEFAULT_POINT_DIAMETER_PX,
      set: n => {
        self.setPointSize(n)
      },
    }),
    ...pinDistinctShapesMenuItems(self),
    ...filterMenuItems({
      narrowings: {
        filter: filterFieldNarrowing(self, () => true),
        hiddenCategories: {
          count: self.activeHiddenCategories.length,
          label: () => 'Show all categories',
          clear: () => {
            self.showAllCategories()
          },
        },
      },
      onEdit: () => {
        getDialogHost(self).queueDialog(handleClose => [
          JexlFilterDialog,
          { model: self, handleClose },
        ])
      },
    }),
    ...categoriesMenuItems(self),
    ...(self.drawsRows ? rowsMenuItems(self) : []),
    ...makeShowSubMenu([
      ...(self.drawsRows
        ? [
            ...treeSidebarShowMenuItems(self),
            showRowLabelsMenuItem(self),
            showRowSeparatorsMenuItem(self),
          ]
        : []),
      ...hiddenGroupsItems(self),
      ...resetSectionOrderItems({
        domain: self.facet?.sort ?? [],
        setDomain: domain => {
          self.setFacetSort(domain)
        },
      }),
      ...legendMenuItems(self),
    ]),
    ...editPlotMenuItems(self),
  ]
}

/** The right-click menu over a hit: its feature, and under `rows` a sort at the column. */
export function markContextMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  const hit = self.contextMenuInfo?.hit
  return hit
    ? [
        {
          label: 'Open feature details',
          icon: MenuOpenIcon,
          onClick: () => {
            self.selectFeature(hit)
          },
        },
        {
          label: 'Copy location',
          icon: ContentCopyIcon,
          onClick: () => {
            void copyText(self, hitLocString(hit), 'location')
          },
        },
        ...(self.drawsRows
          ? [
              sortRowsHereMenuItem({
                label: `Sort rows by ${self.rowCompareLabel} here`,
                rowCount: self.editableSources.length,
                onClick: () => {
                  self.sortRowsByValueAt(hit.refName, hit.bp)
                },
              }),
              ...resetRowOrderMenuItems(self),
            ]
          : []),
      ]
    : []
}
