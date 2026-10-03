import { lazy } from 'react'

import { getDialogHost } from '@jbrowse/core/util'
import PaletteIcon from '@mui/icons-material/Palette'

import type { TreeLayoutModel } from './setColorDialog/SetColorDialog.tsx'
import type { RowSource } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetColorDialog = lazy(() => import('./setColorDialog/SetColorDialog.tsx'))

/**
 * "Edit colors/arrangement...", the row that opens the shared `SetColorDialog`
 * over `model`: the drag-reorder, relabel and recolor grid every tree-sidebar
 * consumer shares. `ready` is "has the row list arrived", since the dialog over
 * an empty list can only report the same thing after the user clicks. A
 * display whose dialog carries more than the rows, as wiggle's plot colours
 * do, passes its own `onOpen`.
 */
export function rowArrangementMenuItem<S extends RowSource>(
  model: TreeLayoutModel<S> & IAnyStateTreeNode,
  { ready, onOpen }: { ready: boolean; onOpen?: () => void },
): MenuItem {
  return {
    label: 'Edit colors/arrangement...',
    icon: PaletteIcon,
    disabled: !ready,
    disabledHelpText: 'Loading rows...',
    onClick:
      onOpen ??
      (() => {
        getDialogHost(model).queueDialog(handleClose => [
          SetColorDialog,
          { model, handleClose },
        ])
      }),
  }
}
