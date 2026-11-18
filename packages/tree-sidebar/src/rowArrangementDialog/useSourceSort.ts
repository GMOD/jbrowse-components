import { useState } from 'react'

import { getStr } from '@jbrowse/core/util'

export interface SortState {
  direction: 'asc' | 'desc'
  field: string | null
}

// Two-state (asc/desc) sort of the rows themselves: a header click reorders
// the list the move buttons then work on, so there is no unsorted state to
// return to. A new column starts ascending, the same column again flips.
export function nextSortState(prev: SortState, field: string): SortState {
  return {
    direction:
      field !== prev.field || prev.direction === 'desc' ? 'asc' : 'desc',
    field,
  }
}

/**
 * Compare two cells: numerically when both parse as finite numbers (so a
 * numeric column like a score sorts 2 < 10, not "10" < "2"), else by locale
 * string order.
 */
function compareRowValues(a: string, b: string) {
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

  return (field: string) => {
    const next = nextSortState(sort, field)
    setSort(next)
    onChange(sortRows(rows, field, next.direction))
  }
}
