import { useState } from 'react'

import { getStr } from '@jbrowse/core/util'

import type { GridSortModel } from '@mui/x-data-grid'

export interface SortState {
  direction: 'asc' | 'desc'
  field: string | null
}

// Two-state (asc/desc) sort layered on MUI's tri-state onSortModelChange.
// Clicking a new column starts ascending; clicking the same column flips
// direction; MUI's third-click "clear" keeps rows sorted and flips direction
// once more so the user never sees an unsorted intermediate state.
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

// Compare two cells: numerically when both parse as finite numbers (so a
// numeric column like a score sorts 2 < 10, not "10" < "2"), else by locale
// string order.
function compareCells(a: unknown, b: unknown): number {
  const na = Number(a)
  const nb = Number(b)
  const bothNumeric =
    a !== '' && b !== '' && Number.isFinite(na) && Number.isFinite(nb)
  return bothNumeric ? na - nb : getStr(a).localeCompare(getStr(b))
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
