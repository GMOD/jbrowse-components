import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { jexlFilterNarrowing } from '@jbrowse/core/util/jexlFilters'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
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
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import { makeScoreAxisMenuItem } from '@jbrowse/wiggle-core'
import { makeMarkSizeSubMenu } from '@jbrowse/wiggle-core/chrome'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import { DEFAULT_POINT_DIAMETER_PX } from './markVocabulary.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RowHeightPreset } from '@jbrowse/tree-sidebar'

const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))
const MarkClusterDialog = lazy(
  () => import('./components/MarkClusterDialog.tsx'),
)

const ROW_HEIGHT_PRESETS: RowHeightPreset[] = [
  { label: 'Normal', rowHeight: 15, rowProportion: 0.8 },
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
          disabled: self.valueMarkIndex === -1,
          disabledHelpText: 'No bar or point mark draws at this zoom',
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
      narrowings: { filter: jexlFilterNarrowing(self) },
      onEdit: () => {
        getDialogHost(self).queueDialog(handleClose => [
          JexlFilterDialog,
          { model: self, handleClose },
        ])
      },
    }),
    ...(self.drawsRows ? rowsMenuItems(self) : []),
    ...makeShowSubMenu([
      ...(self.drawsRows
        ? [...treeSidebarShowMenuItems(self), showRowLabelsMenuItem(self)]
        : []),
      ...hiddenGroupsItems(self),
      ...resetSectionOrderItems({
        domain: self.facet?.sort ?? [],
        setDomain: domain => {
          self.setFacetSort(domain)
        },
      }),
      legendCheckboxItem(self),
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
        ...(self.drawsRows
          ? [
              sortRowsHereMenuItem({
                label: 'Sort rows by value here',
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
