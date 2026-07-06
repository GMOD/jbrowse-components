import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

import type { MenuItem } from '@jbrowse/core/ui'

const MissingnessFilterDialog = lazy(
  () => import('./components/MissingnessFilterDialog.tsx'),
)

/**
 * Creates a menu item for filtering out variants with a high fraction of
 * no-call (missing) genotypes
 * @param model - The model that has setMaxMissingnessFilter action
 * @returns MenuItem for missingness filtering
 */
export function createMissingnessFilterMenuItem(model: {
  maxMissingnessFilter?: number
  setMaxMissingnessFilter: (arg: number) => void
}): MenuItem {
  return {
    label: 'Missingness',
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        MissingnessFilterDialog,
        {
          model,
          handleClose,
        },
      ])
    },
  }
}
