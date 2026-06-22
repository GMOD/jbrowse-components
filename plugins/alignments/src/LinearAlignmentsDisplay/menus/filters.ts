import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'

import type { FilterBy } from '../../shared/types.ts'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

export function getFiltersMenuItem(model: FiltersModel) {
  return {
    label: 'Edit filters...',
    icon: ClearAllIcon,
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        FilterByTagDialog,
        {
          model,
          handleClose,
        },
      ])
    },
  }
}
