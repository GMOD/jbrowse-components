import { useState } from 'react'

import { compareValues } from '@jbrowse/core/util/tableText'

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

export function sortRows<S>(
  rows: S[],
  field: string,
  direction: 'asc' | 'desc',
): S[] {
  return rows.toSorted((a, b) =>
    compareValues(
      (a as Record<string, unknown>)[field],
      (b as Record<string, unknown>)[field],
      direction === 'asc' ? 1 : -1,
    ),
  )
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
