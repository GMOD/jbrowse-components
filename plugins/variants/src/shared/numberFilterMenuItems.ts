import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'

import type { NumberFilterDialogProps } from './components/NumberFilterDialog.tsx'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const NumberFilterDialog = lazy(
  () => import('./components/NumberFilterDialog.tsx'),
)

// The label carries the trailing "..." at each call site: every one of these
// opens the number dialog.
function numberFilterMenuItem(
  model: IAnyStateTreeNode,
  menuLabel: string,
  dialogProps: Omit<NumberFilterDialogProps, 'handleClose'>,
): MenuItem {
  return {
    label: menuLabel,
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        NumberFilterDialog,
        { ...dialogProps, handleClose },
      ])
    },
  }
}

// Menu item for the minor-allele-frequency floor filter.
export function createMAFFilterMenuItem(model: {
  minorAlleleFrequencyFilter?: number
  setMafFilter: (arg: number) => void
}): MenuItem {
  return numberFilterMenuItem(model, 'Minor allele frequency...', {
    title: 'Set minor allele frequency (MAF) filter',
    description:
      'Filter out variants with minor allele frequency below this threshold. Valid range: 0 to 0.5',
    label: 'MAF threshold',
    placeholder: 'Enter MAF (0-0.5)',
    errorText: 'MAF must be between 0 and 0.5',
    min: 0,
    max: 0.5,
    value: model.minorAlleleFrequencyFilter ?? 0,
    onSubmit: arg => {
      model.setMafFilter(arg)
    },
  })
}

// Menu item for the no-call (missing) genotype ceiling filter.
export function createMissingnessFilterMenuItem(model: {
  maxMissingnessFilter?: number
  setMaxMissingnessFilter: (arg: number) => void
}): MenuItem {
  return numberFilterMenuItem(model, 'Missingness...', {
    title: 'Set missingness filter',
    description:
      'Hide variants where the fraction of no-call (missing) genotypes is above this threshold — useful for clearing out the sparse sites that clutter a multi-sample matrix. High missingness can also flag structural variants, so filter with care. Valid range: 0 to 1 (1 keeps every variant).',
    label: 'Max missingness threshold',
    placeholder: 'Enter max missingness (0-1)',
    errorText: 'Missingness must be between 0 and 1',
    min: 0,
    max: 1,
    value: model.maxMissingnessFilter ?? 1,
    onSubmit: arg => {
      model.setMaxMissingnessFilter(arg)
    },
  })
}
