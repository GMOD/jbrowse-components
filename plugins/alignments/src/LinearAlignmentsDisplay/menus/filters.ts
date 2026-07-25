import { lazy } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilterAltIcon from '@mui/icons-material/FilterAlt'

import { defaultFilterFlags } from '../../shared/util.ts'

import type { FilterBy } from '../../shared/types.ts'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

// How many independent filters `filterBy` currently applies, so the menu label
// can say whether any are on. The flag masks are one filter each (they're edited
// together and default non-zero, hence the compare against the default rather
// than against 0), plus one per tag filter and one for a read name.
function activeFilterCount(filterBy: FilterBy) {
  const { flagInclude, flagExclude, readName, tagFilters } = filterBy
  return (
    (flagInclude === defaultFilterFlags.flagInclude &&
    flagExclude === defaultFilterFlags.flagExclude
      ? 0
      : 1) +
    (readName === undefined || readName === '' ? 0 : 1) +
    (tagFilters?.length ?? 0)
  )
}

// One item, not a submenu with one child: the read-category visibility toggles
// (proper pairs, singletons) live in "Show..." (reads.ts), so this only ever
// opens the flag/tag/read-name dialog, and a submenu made that two hops. The
// count is the only affordance telling the user a filter is silently hiding
// reads — nothing else in the track chrome says so.
export function getFiltersMenuItem(model: FiltersModel) {
  const count = activeFilterCount(model.filterBy)
  return {
    label: count > 0 ? `Filter by... (${count})` : 'Filter by...',
    icon: FilterAltIcon,
    onClick: () => {
      getSession(model).queueDialog(handleClose => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  }
}
