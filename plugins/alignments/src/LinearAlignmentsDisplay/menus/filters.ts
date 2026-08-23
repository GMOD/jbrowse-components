import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { getDialogHost } from '@jbrowse/core/util'

import { defaultFilterFlags } from '../../shared/util.ts'

import type { FilterBy } from '../../shared/types.ts'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

// How many independent filters `filterBy` currently applies, so the menu label
// can say whether any are on. The flag masks are one filter each (they're edited
// together and their no-op value is the non-zero default, hence the compare
// against it rather than against 0), plus one per tag filter and one for a read
// name.
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

// One row, not a submenu with one child: the read-category visibility toggles
// (proper pairs, singletons) live in "Show..." (reads.ts), so this only ever
// opens the flag/tag/read-name dialog, and a submenu made that two hops. The
// shared builder keeps it flat for exactly that reason, and carries the count
// that is the only affordance telling the user a filter is silently hiding
// reads — nothing else in the track chrome says so.
//
// No "Clear all filters" row: the dialog owns the reset, and its own controls
// are where a user who opened it expects to find one.
//
// Which is also why this display does NOT declare `narrowings` the way the
// canvas, LD and multi-sample variant menus do. That shape pairs a count with a
// `clear` per entry so the two cannot drift — worth having wherever the menu
// itself offers the undo, which is exactly what this one declines to do. Adopting
// it here would mean writing three `clear` closures nothing calls, or adding a
// flag to suppress the group row the declaration implies. Both are ceremony
// around a decision already made, so this keeps the plain count.
export function getFiltersMenuItems(model: FiltersModel) {
  return filterMenuItems({
    activeCount: activeFilterCount(model.filterBy),
    onEdit: () => {
      getDialogHost(model).queueDialog(handleClose => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  })
}
