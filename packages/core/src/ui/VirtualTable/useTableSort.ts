import { useState } from 'react'

import { compareValues } from '../../util/tableText.ts'

/**
 * A table's header sort: the rows in the order the clicked column puts them,
 * blanks last, and the props `VirtualTable` takes to show and change it. A
 * column sorts by its entry in `sortKeys`, and a field with none leaves the
 * rows as given.
 */
export function useTableSort<R>(
  rows: readonly R[],
  sortKeys: Record<string, (row: R) => unknown>,
) {
  const [sort, setSort] = useState({ field: '', ascending: true })
  const sortKey = sortKeys[sort.field]
  const direction = sort.ascending ? 1 : -1
  const sortedRows = sortKey
    ? rows
        .map(row => ({ row, key: sortKey(row) }))
        .sort((a, b) => compareValues(a.key, b.key, direction))
        .map(({ row }) => row)
    : rows
  return {
    sortedRows,
    sortProps: {
      sortField: sort.field,
      sortAscending: sort.ascending,
      onSort: (field: string, ascending: boolean) => {
        setSort({ field, ascending })
      },
    },
    sortResetKey: `${sort.field}:${sort.ascending}`,
  }
}
