import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilterAltIcon from '@mui/icons-material/FilterAlt'

import type { FilterBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

// "Filter by..." parallels the other "... by..." submenus; the read-category
// visibility toggles (proper pairs, singletons) live in "Show..." (reads.ts),
// so this currently holds just the flag/tag/read-name dialog.
export function getFiltersMenuItem(model: FiltersModel) {
  return {
    label: 'Filter by...',
    icon: FilterAltIcon,
    type: 'subMenu' as const,
    subMenu: [
      {
        label: 'Edit filters...',
        onClick: () => {
          getSession(model).queueDialog(handleClose => [
            FilterByTagDialog,
            { model, handleClose },
          ])
        },
      },
    ] satisfies MenuItem[],
  }
}
