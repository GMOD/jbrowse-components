import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeRadioSubMenu, withHint } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'

import {
  READ_CATEGORIES,
  activeReadCategoryCount,
  readCategoryChoice,
  setReadCategory,
} from '../../shared/readCategoryFilters.ts'
import { defaultFilterFlags } from '../../shared/util.ts'

import type {
  ReadCategoryChoice,
  ReadCategorySpec,
} from '../../shared/readCategoryFilters.ts'
import type { FilterBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterBy: FilterBy
  setFilterBy: (arg: FilterBy) => void
}

// How many independent filters `filterBy` applies. The flag masks are one filter
// between them (they're edited together and their no-op value is the non-zero
// default, hence the compare against it rather than against 0), plus one per tag
// filter, one for a read name and one per read category in effect.
export function activeFilterCount(filterBy: FilterBy) {
  const { flagInclude, flagExclude, readName, tagFilters } = filterBy
  return (
    (flagInclude === defaultFilterFlags.flagInclude &&
    flagExclude === defaultFilterFlags.flagExclude
      ? 0
      : 1) +
    (readName === undefined || readName === '' ? 0 : 1) +
    (tagFilters?.length ?? 0) +
    activeReadCategoryCount(filterBy)
  )
}

// The whole of `filterBy` as one entry rather than one per field: the dialog's
// own Reset is the per-field recovery, and each category row below undoes
// itself, so naming an undo row here would offer a second, coarser one.
function filterNarrowings(model: FiltersModel): Reversibles {
  return {
    filterBy: {
      count: activeFilterCount(model.filterBy),
      clear: () => {
        model.setFilterBy(defaultFilterFlags)
      },
    },
  }
}

// One submenu per category, three radios inside. Radios rather than the
// checkboxes these were before folding into `filterBy`, because each carries a
// third state now — "only proper pairs" and "hide split alignments" are moves
// the booleans could not express.
//
// The choice shows on the parent row (`withHint`), so which categories are
// filtering is readable without opening any of them, and the help text sits
// there too rather than on all three radios saying much the same thing.
function readCategoryItem(
  model: FiltersModel,
  { key, noun, only, exclude, helpText }: ReadCategorySpec,
): MenuItem {
  const current = readCategoryChoice(model.filterBy, key)
  return makeRadioSubMenu<ReadCategoryChoice>({
    // 'hidden' rather than the stored 'exclude': the row is reporting what the
    // user sees, and the vocabulary is the wire format's, not theirs.
    label: withHint(
      noun,
      current === 'all' ? undefined : current === 'only' ? 'only' : 'hidden',
    ),
    helpText,
    value: current,
    options: [
      ['all', 'All reads'],
      ['only', only],
      ['exclude', exclude],
    ],
    onChange: choice => {
      model.setFilterBy(setReadCategory(model.filterBy, key, choice))
    },
  })
}

/**
 * The "Filter by..." family for an alignments display.
 *
 * `readCategories` adds the four whole-read filters. LGVSyntenyDisplay shares
 * this model chain, and so inherits the `filterBy` slot they now live in, but a
 * PAF block has no mate, no pair flag, no SA tag and no CIGAR skip — the same
 * reason `getSyntenyShowMenuItems` omits their old home rather than showing
 * dead checkboxes.
 *
 * With them the group is always a submenu, which costs the dialog the extra hop
 * it used to save by being a lone top-level row. That is the right way round:
 * the categories are the everyday filters — an SV read toggles proper pairs off
 * and back several times a locus — and editing a bitmask is the rare one.
 */
export function getFiltersMenuItems(
  model: FiltersModel,
  { readCategories = false }: { readCategories?: boolean } = {},
) {
  return filterMenuItems({
    narrowings: filterNarrowings(model),
    subItems: readCategories
      ? READ_CATEGORIES.map(c => readCategoryItem(model, c))
      : [],
    onEdit: () => {
      getDialogHost(model).queueDialog(handleClose => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  })
}
