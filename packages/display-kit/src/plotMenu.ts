import { lazy } from 'react'

import { getDialogHost } from '@jbrowse/core/util'
import DataObjectIcon from '@mui/icons-material/DataObject'

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
 * The track menu's "Edit plot...", which a display places under the rows
 * that pick its grammar settings one at a time. None on a display that
 * declares no plot setting.
 */
export function editPlotMenuItems(display: PlotDisplay): MenuItem[] {
  return display.plotKeys.length
    ? [
        {
          label: 'Edit plot...',
          icon: DataObjectIcon,
          helpText:
            "This track's colour, grouping, rows, scales and filters as text, as a config file writes them",
          onClick: () => {
            openPlotDialog(display)
          },
        },
      ]
    : []
}
