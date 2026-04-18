import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'

import type { FilterBy } from '../types.ts'

const FilterByTagDialog = lazy(
  () => import('../components/FilterByTagDialog.tsx'),
)

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
  drawSingletons?: boolean
  drawProperPairs?: boolean
  setDrawSingletons?: (arg: boolean) => void
  setDrawProperPairs?: (arg: boolean) => void
}

export function getFiltersMenuItem(
  model: FiltersModel,
  opts?: { showPairFilters?: boolean },
) {
  const showPairFilters = opts?.showPairFilters ?? false
  return {
    label: 'Filter by...',
    icon: ClearAllIcon,
    type: 'subMenu' as const,
    subMenu: [
      ...(showPairFilters
        ? [
            {
              label: 'Show singletons',
              type: 'checkbox' as const,
              checked: model.drawSingletons ?? false,
              onClick: () => {
                model.setDrawSingletons?.(!model.drawSingletons)
              },
            },
            {
              label: 'Show proper pairs',
              type: 'checkbox' as const,
              checked: model.drawProperPairs ?? false,
              onClick: () => {
                model.setDrawProperPairs?.(!model.drawProperPairs)
              },
            },
            { type: 'divider' as const },
          ]
        : []),
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
