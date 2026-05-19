import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

const SetRowHeightDialog = lazy(
  () => import('../components/SetRowHeightDialog.tsx'),
)

interface RowHeightModel {
  rowHeight: number
  rowHeightMode: number
  rowSpacing: boolean
  setRowHeight: (h: number) => void
  setFitToHeight: () => void
  setRowSpacing: (s: boolean) => void
}

export function getRowHeightMenuItem(model: RowHeightModel): MenuItem {
  return {
    label: 'Row height',
    subMenu: [
      {
        label: 'Manually set row height',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetRowHeightDialog,
            {
              model,
              handleClose,
            },
          ])
        },
      },
      {
        label: 'Fit to display height',
        type: 'checkbox' as const,
        checked: model.rowHeightMode === 0,
        onClick: () => {
          if (model.rowHeightMode === 0) {
            model.setRowHeight(model.rowHeight)
          } else {
            model.setFitToHeight()
          }
        },
      },
      {
        label: 'Row spacing',
        type: 'checkbox' as const,
        checked: model.rowSpacing,
        onClick: () => {
          model.setRowSpacing(!model.rowSpacing)
        },
      },
    ],
  }
}
