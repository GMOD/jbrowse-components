import { useState } from 'react'

import { compareValues } from '../../util/tableText.ts'

import type { VirtualTableColumn } from './VirtualTable.tsx'

/**
 * A table's header sort: the rows in the order the clicked column's
 * `sortValue` puts them, blanks last, and the props `VirtualTable` takes to
 * show and change it. Only a column on show sorts, so while the sorted column
 * is hidden the rows stay as given and no header shows an arrow.
 */
export function useTableSort<R>(
  rows: readonly R[],
  columns: readonly Pick<VirtualTableColumn<R>, 'id' | 'sortValue'>[],
) {
  const [sort, setSort] = useState({ field: '', ascending: true })
  const sortValue = columns.find(col => col.id === sort.field)?.sortValue
  const direction = sort.ascending ? 1 : -1
  const sortedRows = sortValue
    ? rows
        .map(row => ({ row, key: sortValue(row) }))
        .sort((a, b) => compareValues(a.key, b.key, direction))
        .map(({ row }) => row)
    : rows
  return {
    sortedRows,
    sortProps: {
      sortField: sortValue ? sort.field : '',
      sortAscending: sort.ascending,
      onSort: (field: string, ascending: boolean) => {
        setSort({ field, ascending })
      },
    },
  }
}
