import { lazy } from 'react'

import { getDialogHost } from '@jbrowse/core/util'
import ChecklistIcon from '@mui/icons-material/Checklist'

import type { SectionsDialogModel } from './SectionsDialog.tsx'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SectionsDialog = lazy(() => import('./SectionsDialog.tsx'))

export type SectionsHost = SectionsDialogModel & IStateTreeNode

/**
 * "Sections...", the checklist of `model`'s sections, while it has a choice
 * to offer: two sections, or one hidden. `node` places the dialog. A band whose sections are not its display's
 * own passes the display as `node` and the band as `model`.
 */
export function sectionsMenuItemsFor(
  node: IStateTreeNode,
  model: SectionsDialogModel,
): MenuItem[] {
  const known = model.knownSections.length
  return known > 1 || (known === 1 && model.hiddenGroups.size > 0)
    ? [
        {
          label: 'Sections...',
          icon: ChecklistIcon,
          onClick: () => {
            getDialogHost(node).queueDialog(handleClose => [
              SectionsDialog,
              { model, handleClose },
            ])
          },
        },
      ]
    : []
}

/** "Sections...", for a display whose sections are its own. */
export function sectionsMenuItems(display: SectionsHost): MenuItem[] {
  return sectionsMenuItemsFor(display, display)
}
