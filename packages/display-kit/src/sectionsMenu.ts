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

export function openSectionsDialog(display: SectionsHost) {
  getDialogHost(display).queueDialog(handleClose => [
    SectionsDialog,
    { model: display, handleClose },
  ])
}

/**
 * "Sections...", the checklist of a grouped track's sections, while the
 * track knows any.
 */
export function sectionsMenuItems(display: SectionsHost): MenuItem[] {
  return display.knownSections.length > 0
    ? [
        {
          label: 'Sections...',
          icon: ChecklistIcon,
          onClick: () => {
            openSectionsDialog(display)
          },
        },
      ]
    : []
}
