import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

const MAFFilterDialog = lazy(() => import('./components/MAFFilterDialog.tsx'))

/**
 * Creates a menu item for MAF (Minor Allele Frequency) filtering
 * @param model - The model that has setMafFilter action
 * @returns MenuItem for MAF filtering
 */
export function createMAFFilterMenuItem(model: {
  minorAlleleFrequencyFilter?: number
  setMafFilter: (arg: number) => void
}): MenuItem {
  return {
    label: 'Minor allele frequency',
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        MAFFilterDialog,
        {
          model,
          handleClose,
        },
      ])
    },
  }
}
