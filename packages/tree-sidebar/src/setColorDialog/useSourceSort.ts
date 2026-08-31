import { useState } from 'react'

import { getStr } from '@jbrowse/core/util'

import type { GridSortModel } from '@mui/x-data-grid'

export interface SortState {
  direction: 'asc' | 'desc'
  field: string | null
}

// Two-state (asc/desc) sort. SourceGrid pins `sortModel` empty, so MUI re-emits
// `asc` on every header click and its own tri-state never advances — direction
// lives here: a new column starts ascending, the same column again flips. An
// empty model (MUI's clear) keeps the field and flips too, so the user never
// sees an unsorted intermediate state.
export function nextSortState(
  prev: SortState,
  model: GridSortModel,
): SortState {
  const requested = model[0]?.field
  const field = requested ?? prev.field
  const isNewField = requested !== undefined && requested !== prev.field
  return {
    direction: isNewField ? 'asc' : prev.direction === 'asc' ? 'desc' : 'asc',
    field,
  }
}

/**
 * Compare two row values: numerically when both parse as finite numbers (so a
 * numeric column like a score sorts 2 < 10, not "10" < "2"), else by locale
 * string order.
 *
 * Exported because a row value written as a number is not this dialog's
 * situation, it is the row axis's: a partition field naming chromHMM states
 * gives rows "1" through "25", and plain string order files state 10 between 1
 * and 2 there exactly as it would in this grid.
 */
export function compareRowValues(a: string, b: string) {
  const na = Number(a)
  const nb = Number(b)
  const bothNumeric =
    a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)
  return bothNumeric ? na - nb : a.localeCompare(b)
}

// An unset cell normalizes to '' — most row fields are optional, and
// stringifying one through String(undefined) sorted it among values starting
// with "u" instead of clustering the unset rows at one end. '' is also what
// keeps `null` out of the numeric branch, where Number(null) is 0.
function compareCells(a: unknown, b: unknown): number {
  return compareRowValues(
    a === undefined || a === null ? '' : getStr(a),
    b === undefined || b === null ? '' : getStr(b),
  )
}

export function sortRows<S>(
  rows: S[],
  field: string,
  direction: 'asc' | 'desc',
): S[] {
  return rows.toSorted((a, b) => {
    const cmp = compareCells(
      (a as Record<string, unknown>)[field],
      (b as Record<string, unknown>)[field],
    )
    return direction === 'asc' ? cmp : -cmp
  })
}

export function useSourceSort<S extends { name: string }>(
  rows: S[],
  onChange: (arg: S[]) => void,
) {
  const [sort, setSort] = useState<SortState>({
    direction: 'asc',
    field: null,
  })

  return (model: GridSortModel) => {
    const next = nextSortState(sort, model)
    setSort(next)
    onChange(next.field ? sortRows(rows, next.field, next.direction) : rows)
  }
}
