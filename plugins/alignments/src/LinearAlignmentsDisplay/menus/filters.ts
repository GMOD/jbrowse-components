import { lazy } from 'react'

import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeRadioSubMenu } from '@jbrowse/core/ui/menuItems'
import { getDialogHost } from '@jbrowse/core/util'
import { MAPQ_BINS } from '@jbrowse/core/util/colorScale'
import { lowerBoundOf, withLowerBound } from '@jbrowse/core/util/fieldPredicate'
import {
  categoryEntries,
  categoryFilterItem,
  categoryOf,
} from '@jbrowse/display-kit/categoryFilter'

import { entriesOn } from '../../shared/alignmentsFilter.ts'
import { READ_CATEGORIES } from '../../shared/readCategoryFilters.ts'

import type { ReadCategorySpec } from '../../shared/readCategoryFilters.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Reversible, Reversibles } from '@jbrowse/core/ui/filterMenuItems'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const FilterByTagDialog = lazy(() => import('../dialogs/FilterByTagDialog.tsx'))

interface FiltersModel {
  filterPredicates: FieldPredicate[]
  setFilterFields: (
    patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
  ) => void
  /** How `filter` differs from what the track's config declares. */
  filterNarrowing: (selects?: (field: string) => boolean) => Reversible
}

interface FiltersMenuOptions {
  readCategories?: boolean
  more?: MenuItem[]
  /**
   * The `filter` fields in effect, where some narrow a layer that is off. A
   * field the menu offers no row for must not count, or the label shows a
   * "(1)" nothing in the submenu explains.
   */
  counts?: (field: string) => boolean
  /** Narrowings kept outside `filter`, such as the per-base layer's. */
  narrowings?: Reversibles
}

export const MORE_FILTERS_LABEL = 'More filters...'

// The categories a user flips several times at a locus; the rest are in the
// "More filters..." dialog.
const MENU_CATEGORIES = READ_CATEGORIES.filter(c => c.key !== 'alone')

// The whole of `filter` as one entry rather than one per field: the dialog's
// own Reset is the per-field recovery, and each category row below undoes
// itself, so naming an undo row here would offer a second, coarser one.
function filterNarrowings(
  model: FiltersModel,
  { counts, narrowings }: FiltersMenuOptions,
): Reversibles {
  return { filter: model.filterNarrowing(counts), ...narrowings }
}

function readCategoryItem(
  model: FiltersModel,
  spec: ReadCategorySpec,
): MenuItem {
  return categoryFilterItem(
    {
      noun: spec.noun,
      only: spec.only,
      exclude: spec.exclude,
      all: 'All reads',
    },
    categoryOf(model.filterPredicates, spec.key),
    value => {
      model.setFilterFields({ [spec.key]: categoryEntries(spec.key, value) })
    },
  )
}

// The thresholds are the mapping-quality facet's bin edges. A value the dialog
// wrote that is none of them gets a radio of its own.
const MAPQ_THRESHOLDS: number[] = MAPQ_BINS.map(b => b.min)
  .filter(min => min > 0)
  .toReversed()

function minMapqItem(model: FiltersModel): MenuItem {
  const current = lowerBoundOf(model.filterPredicates, 'mapq')
  const thresholds =
    current === undefined || MAPQ_THRESHOLDS.includes(current)
      ? MAPQ_THRESHOLDS
      : [...MAPQ_THRESHOLDS, current].toSorted((a, b) => a - b)
  return makeRadioSubMenu({
    label: 'Mapping quality',
    value: current === undefined ? 'all' : `${current}`,
    options: [
      ['all', 'All reads'],
      ...thresholds.map((min): [string, string] => [`${min}`, `MAPQ ${min}+`]),
    ],
    onChange: choice => {
      model.setFilterFields({
        mapq: withLowerBound(
          entriesOn(model.filterPredicates, 'mapq'),
          'mapq',
          choice === 'all' ? undefined : Number(choice),
        ),
      })
    },
  })
}

/**
 * The "Filter by..." family for an alignments display.
 *
 * `readCategories` adds the four whole-read filters, and `more` the rows on
 * data derived from reads (connections, junctions). LGVSyntenyDisplay shares
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
  options: FiltersMenuOptions = {},
) {
  const { readCategories = false, more = [] } = options
  const openDialog = () => {
    getDialogHost(model).queueDialog(handleClose => [
      FilterByTagDialog,
      { model, handleClose },
    ])
  }
  // With the categories, the dialog row follows them under its own name, since
  // it holds every filter the submenu leaves out.
  return readCategories
    ? filterMenuItems({
        narrowings: filterNarrowings(model, options),
        subItems: [
          minMapqItem(model),
          ...MENU_CATEGORIES.map(c => readCategoryItem(model, c)),
          ...more,
          { label: MORE_FILTERS_LABEL, onClick: openDialog },
        ],
      })
    : filterMenuItems({
        narrowings: filterNarrowings(model, options),
        subItems: [minMapqItem(model), ...more],
        onEdit: openDialog,
      })
}
