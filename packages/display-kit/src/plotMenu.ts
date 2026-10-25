import { lazy } from 'react'

import { TRACK_MENU_PRIORITY } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import TuneIcon from '@mui/icons-material/Tune'

import type { PlotDialogHost } from './PlotDialog.tsx'
import type { Plot, PlotWriteOptions } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const PlotDialog = lazy(() => import('./PlotDialog.tsx'))

export type PlotDisplay = PlotDialogHost & IStateTreeNode

/**
 * Open the plot as text, seeded with a draft a dialog has not applied; a
 * `whole` seed is the whole plot, so a setting it leaves out stays out.
 */
export function openPlotDialog(
  display: PlotDisplay,
  seed?: Plot,
  seedOptions?: PlotWriteOptions,
) {
  getDialogHost(display).queueDialog(handleClose => [
    PlotDialog,
    { model: display, seed, seedOptions, handleClose },
  ])
}

function withoutIcon(item: MenuItem): MenuItem {
  if (!('icon' in item) || item.icon === undefined) {
    return item
  }
  const { icon: _icon, ...rest } = item
  return rest
}

// A row's kind, in the order Advanced lists them: rows that act or open a
// dialog, then submenus, then toggles. Advanced collects rows from several
// features, so grouping by kind is what keeps it scannable.
function rowKindRank(item: MenuItem) {
  return 'subMenu' in item
    ? 1
    : 'type' in item && (item.type === 'checkbox' || item.type === 'radio')
      ? 2
      : 0
}

/**
 * The track menu's Advanced submenu holding "Edit plot..." and a display's
 * `more` rows, grouped by kind, sorted just above "Display types" wherever a
 * display places it. None on a display that declares no plot setting.
 */
export function editPlotMenuItems(
  display: PlotDisplay,
  more: MenuItem[] = [],
): MenuItem[] {
  return display.plotKeys.length
    ? [
        {
          label: 'Advanced',
          icon: TuneIcon,
          type: 'subMenu',
          priority: TRACK_MENU_PRIORITY.advanced,
          subMenu: [
            {
              label: 'Edit plot...',
              onClick: () => {
                openPlotDialog(display)
              },
            },
            // no row icons: rows from several features gather here, and an
            // icon on some of them reads as a difference that is not there
            ...more
              .toSorted((a, b) => rowKindRank(a) - rowKindRank(b))
              .map(withoutIcon),
          ],
        },
      ]
    : []
}
