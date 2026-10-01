import { lazy } from 'react'

import { getDialogHost } from '@jbrowse/core/util'
import DataObjectIcon from '@mui/icons-material/DataObject'
import TuneIcon from '@mui/icons-material/Tune'

import type { PlotDialogHost } from './PlotDialog.tsx'
import type { Plot } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const PlotDialog = lazy(() => import('./PlotDialog.tsx'))

export type PlotDisplay = PlotDialogHost & IStateTreeNode

/** Open the plot as text, seeded with a draft a dialog has not applied. */
export function openPlotDialog(display: PlotDisplay, seed?: Plot) {
  getDialogHost(display).queueDialog(handleClose => [
    PlotDialog,
    { model: display, seed, handleClose },
  ])
}

/**
 * The track menu's Advanced submenu holding "Edit plot...", sorted just
 * above "Display types" wherever a display places it. None on a display that
 * declares no plot setting.
 */
export function editPlotMenuItems(display: PlotDisplay): MenuItem[] {
  return display.plotKeys.length
    ? [
        {
          label: 'Advanced',
          icon: TuneIcon,
          type: 'subMenu',
          priority: -999,
          subMenu: [
            {
              label: 'Edit plot...',
              icon: DataObjectIcon,
              helpText:
                "This track's colour, grouping, rows, scales and filters as text, as a config file writes them",
              onClick: () => {
                openPlotDialog(display)
              },
            },
          ],
        },
      ]
    : []
}
