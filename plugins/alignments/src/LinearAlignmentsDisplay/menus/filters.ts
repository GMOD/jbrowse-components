import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeRadioSubMenu, withHint } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import { MAPQ_BINS } from '@jbrowse/core/util/colorScale'

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
import type { ReadFilter } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversibles } from '@jbrowse/core/ui/filterMenuItems'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  readFilter: ReadFilter
  setReadFilter: (arg: ReadFilter) => void
}

// How many independent filters `filterBy` applies. The flag masks are one filter
// between them (they're edited together and their no-op value is the non-zero
// default, hence the compare against it rather than against 0), plus one per tag
// filter, one for a read name and one per read category in effect.
function activeFilterCount(filterBy: ReadFilter) {
  const { flagInclude, flagExclude, minMapq, readName, tagFilters } = filterBy
  return (
    (flagInclude === defaultFilterFlags.flagInclude &&
    flagExclude === defaultFilterFlags.flagExclude
      ? 0
      : 1) +
    (minMapq === undefined ? 0 : 1) +
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
      count: activeFilterCount(model.readFilter),
      clear: () => {
        model.setReadFilter(defaultFilterFlags)
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
  const current = readCategoryChoice(model.readFilter, key)
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
      model.setReadFilter(setReadCategory(model.readFilter, key, choice))
    },
  })
}

// The thresholds are the mapping-quality facet's bin edges, so "MAPQ 10+"
// keeps exactly the sections a facet over `mapq` draws above it. A value the
// dialog wrote that is none of them gets a radio of its own.
const MAPQ_THRESHOLDS: number[] = MAPQ_BINS.map(b => b.min)
  .filter(min => min > 0)
  .toReversed()

function minMapqItem(model: FiltersModel): MenuItem {
  const current = model.readFilter.minMapq
  const thresholds =
    current === undefined || MAPQ_THRESHOLDS.includes(current)
      ? MAPQ_THRESHOLDS
      : [...MAPQ_THRESHOLDS, current].toSorted((a, b) => a - b)
  return makeRadioSubMenu({
    label: withHint(
      'Mapping quality',
      current === undefined ? undefined : `${current}+`,
    ),
    helpText:
      'Hide reads mapped with low confidence. A read whose mapping quality is unavailable (255) is hidden under any threshold.',
    value: current === undefined ? 'all' : `${current}`,
    options: [
      ['all', 'All reads'],
      ...thresholds.map((min): [string, string] => [`${min}`, `MAPQ ${min}+`]),
    ],
    onChange: choice => {
      model.setReadFilter({
        ...model.readFilter,
        minMapq: choice === 'all' ? undefined : Number(choice),
      })
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
    subItems: [
      minMapqItem(model),
      ...(readCategories
        ? READ_CATEGORIES.map(c => readCategoryItem(model, c))
        : []),
    ],
    onEdit: () => {
      getDialogHost(model).queueDialog(handleClose => [
        FilterByTagDialog,
        { model, handleClose },
      ])
    },
  })
}
