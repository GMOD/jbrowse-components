import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeRadioSubMenu, withHint } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import { MAPQ_BINS } from '@jbrowse/core/util/colorScale'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'

import { READ_CATEGORIES } from '../../shared/readCategoryFilters.ts'

import type { ReadCategorySpec } from '../../shared/readCategoryFilters.ts'
import type { ReadFilter } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversible, Reversibles } from '@jbrowse/core/ui/filterMenuItems'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  readFilter: ReadFilter
  setReadFilter: (arg: ReadFilter) => void
  /** How `filter` differs from what the track's config declares. */
  filterNarrowing: () => Reversible
}

// The whole of `filterBy` as one entry rather than one per field: the dialog's
// own Reset is the per-field recovery, and each category row below undoes
// itself, so naming an undo row here would offer a second, coarser one.
function filterNarrowings(model: FiltersModel): Reversibles {
  return { filterBy: model.filterNarrowing() }
}

function readCategoryItem(
  model: FiltersModel,
  spec: ReadCategorySpec,
): MenuItem {
  return categoryFilterItem(
    { ...spec, all: 'All reads' },
    model.readFilter[spec.key],
    value => {
      model.setReadFilter({ ...model.readFilter, [spec.key]: value })
    },
  )
}

// The thresholds are the mapping-quality facet's bin edges. A value the dialog
// wrote that is none of them gets a radio of its own.
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
      'Hide reads mapped with low confidence. A read with MAPQ 255 (none reported) stays under any threshold.',
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
 * this model chain and its `filter` slot, but a PAF block has no mate, no pair
 * flag, no SA tag and no CIGAR skip, so of the four only `svSignal` answers
 * there, by its SV-size indels, and its menu leaves them out.
 *
 * With them the group is always a submenu, which costs the dialog the extra hop
 * it used to save by being a lone top-level row. That is the right way round:
 * the categories are the everyday filters — an SV review toggles SV evidence
 * on and off several times a locus — and editing a bitmask is the rare one.
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
