import { lazy } from 'react'

import { capitalizeFirst, getDialogHost } from '@jbrowse/core/util'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import ChecklistIcon from '@mui/icons-material/Checklist'

import type { SectionsDialogModel } from './SectionsDialog.tsx'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SectionsDialog = lazy(() => import('./SectionsDialog.tsx'))

export type SectionsHost = SectionsDialogModel & IStateTreeNode

/**
 * The Sections dialog's column header for a facet on `field`: the field's
 * own name, or "Section" for an expression or no field.
 */
export function fieldHeading(field = '') {
  return field && !isJexl(field) ? capitalizeFirst(field) : 'Section'
}

/**
 * "Sections...", the checklist of `model`'s sections, while it knows any;
 * `node` places the dialog. A band whose sections are not its display's
 * own passes the display as `node` and the band as `model`.
 */
export function sectionsMenuItemsFor(
  node: IStateTreeNode,
  model: SectionsDialogModel,
): MenuItem[] {
  return model.knownSections.length > 0
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
