import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilterAltIcon from '@mui/icons-material/FilterAlt'

import { checkboxItem } from './menuHelpers.ts'

import type { FilterBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

interface FiltersMenuOptions {
  // SAM-flag read-category filters. Passed explicitly by the alignments display;
  // omitted by synteny, which inherits the fields from the base model but has no
  // paired-end flags for them to mean anything. When present the item becomes a
  // "Filter by..." hub; when omitted it stays a single "Edit filters..." action.
  pairFilters?: {
    drawProperPairs: boolean
    setDrawProperPairs: (v: boolean) => void
    drawSingletons: boolean
    setDrawSingletons: (v: boolean) => void
  }
}

// One home for "which reads are shown": the read-name/tag/flag dialog plus the
// per-read-category flag toggles (proper pairs, singletons). Those are ordinary
// SAM-flag filters that also thin the coverage histogram, so they belong here,
// not under "Read connections" where they used to hide.
export function getFiltersMenuItem(
  model: FiltersModel,
  options: FiltersMenuOptions = {},
) {
  const { pairFilters } = options
  const openDialog = () => {
    getSession(model).queueDialog(handleClose => [
      FilterByTagDialog,
      { model, handleClose },
    ])
  }
  return pairFilters
    ? {
        label: 'Filter by...',
        icon: FilterAltIcon,
        type: 'subMenu' as const,
        subMenu: [
          checkboxItem(
            'Show proper pairs',
            pairFilters.drawProperPairs,
            () => {
              pairFilters.setDrawProperPairs(!pairFilters.drawProperPairs)
            },
          ),
          checkboxItem('Show singletons', pairFilters.drawSingletons, () => {
            pairFilters.setDrawSingletons(!pairFilters.drawSingletons)
          }),
          { type: 'divider' as const },
          {
            label: 'Edit read name / tag / flag filters...',
            onClick: () => {
              openDialog()
            },
          },
        ] satisfies MenuItem[],
      }
    : {
        label: 'Edit filters...',
        icon: FilterAltIcon,
        onClick: () => {
          openDialog()
        },
      }
}
