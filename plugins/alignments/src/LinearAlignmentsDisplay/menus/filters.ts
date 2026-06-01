import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import ClearAllIcon from '@mui/icons-material/ClearAll'

import { checkboxItem } from './menuHelpers.ts'

import type { FilterBy } from '../../shared/types.ts'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

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
            checkboxItem('Show singletons', model.drawSingletons ?? false, () => {
              model.setDrawSingletons?.(!model.drawSingletons)
            }),
            checkboxItem(
              'Show proper pairs',
              model.drawProperPairs ?? false,
              () => {
                model.setDrawProperPairs?.(!model.drawProperPairs)
              },
            ),
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
