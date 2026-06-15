import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'

import type { FilterBy } from '../../shared/types.ts'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))
const SetSashimiScoreDialog = lazy(
  () => import('../dialogs/SetSashimiScoreDialog.tsx'),
)

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void

  minSashimiScore: number
  setMinSashimiScore: (score: number) => void
}

export function getFiltersMenuItem(model: FiltersModel) {
  return {
    label: 'Filter...',
    icon: ClearAllIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Filter sashimi arcs by score...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            SetSashimiScoreDialog,
            {
              model,
              handleClose,
            },
          ])
        },
      },
      {
        label: 'Edit filters...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            FilterByTagDialog,
            {
              model,
              handleClose,
            },
          ])
        },
      },
    ],
  }
}
