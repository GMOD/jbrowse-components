import { useState } from 'react'

import { getStr } from '@jbrowse/core/util'

import type { GridSortModel } from '@mui/x-data-grid'

interface SortState {
  direction: 'asc' | 'desc'
  field: string | null
}

// Two-state (asc/desc) sort layered on MUI's tri-state onSortModelChange.
// Clicking a new column starts ascending; clicking the same column flips
// direction; MUI's third-click "clear" keeps the rows sorted and flips
// direction once more so the user never sees an unsorted intermediate state.
export function useSourceSort<S extends { name: string }>(
  rows: S[],
  onChange: (arg: S[]) => void,
) {
  const [sort, setSort] = useState<SortState>({
    direction: 'asc',
    field: null,
  })

  return (model: GridSortModel) => {
    const requested = model[0]?.field
    const field = requested ?? sort.field
    const isNewField = requested !== undefined && requested !== sort.field
    const direction = isNewField
      ? 'asc'
      : sort.direction === 'asc'
        ? 'desc'
        : 'asc'
    setSort({ direction, field })
    if (field) {
      onChange(
        [...rows].sort((a, b) => {
          const aa = getStr((a as Record<string, unknown>)[field])
          const bb = getStr((b as Record<string, unknown>)[field])
          return direction === 'asc'
            ? aa.localeCompare(bb)
            : bb.localeCompare(aa)
        }),
      )
    } else {
      onChange(rows)
    }
  }
}
