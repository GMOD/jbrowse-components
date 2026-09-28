import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { jexlFilterNarrowing } from '@jbrowse/core/util/jexlFilters'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import { sectionOrderMenuItems } from '@jbrowse/display-kit/groupByMenu'
import {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  sortRowsHereMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import {
  DEFAULT_POINT_DIAMETER_PX,
  makeCrossHatchItem,
  makeScoreSubMenu,
} from '@jbrowse/wiggle-core'
import { makePointSizeSubMenu } from '@jbrowse/wiggle-core/chrome'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ShowChartIcon from '@mui/icons-material/ShowChart'

import type { LinearMarkDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RowHeightPreset } from '@jbrowse/tree-sidebar'

const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))
const MarkRowArrangementDialog = lazy(
  () => import('./components/MarkRowArrangementDialog.tsx'),
)
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
    rowArrangementMenuItem({
      ready: self.editableSources.length > 0,
      onOpen: () => {
        getDialogHost(self).queueDialog(handleClose => [
          MarkRowArrangementDialog,
          { model: self, handleClose },
        ])
      },
    }),
    ...resetRowOrderMenuItems(self),
    clusteringMenuItem(
      self,
      {
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
      self.clusterableSources.length,
    ),
  ]
}

/** The track menu: the plot editor, the axis, the filter, the sections and rows, and the chrome toggles. */
export function markTrackMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  return [
    {
      label: 'Edit plot...',
      icon: ShowChartIcon,
      onClick: () => {
        self.openMarkPlotDialog()
      },
    },
    makeScoreSubMenu(self),
    ...makePointSizeSubMenu({
      label: 'Point size',
      applies: self.hasPointMark,
      value: () => self.pointSize,
      defaultValue: DEFAULT_POINT_DIAMETER_PX,
      set: n => {
        self.setPointSize(n)
      },
    }),
    ...filterMenuItems({
      narrowings: { filter: jexlFilterNarrowing(self) },
      onEdit: () => {
        getDialogHost(self).queueDialog(handleClose => [
          JexlFilterDialog,
          { model: self, handleClose },
        ])
      },
    }),
    ...sectionOrderMenuItems({
      sections: self.facetLayout.rows ? [] : self.facetLayout.sections,
      domain: self.facet?.domain ?? [],
      setDomain: domain => {
        self.setFacetDomain(domain)
      },
      hideGroup: key => {
        self.hideGroup(key)
      },
    }),
    ...(self.drawsRows ? rowsMenuItems(self) : []),
    ...densityTierMenuItems(self),
    ...makeShowSubMenu([
      ...(self.drawsRows
        ? [...treeSidebarShowMenuItems(self), showRowLabelsMenuItem(self)]
        : []),
      makeCrossHatchItem(self),
      legendCheckboxItem(self),
    ]),
  ]
}

/** The right-click menu over a hit: its feature, and under `rows` a sort at the column. */
export function markContextMenuItems(self: LinearMarkDisplayModel): MenuItem[] {
  const hit = self.coarseTierStandsIn ? undefined : self.contextMenuInfo?.hit
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
