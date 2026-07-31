import { measureGridWidth } from '@jbrowse/core/util'

import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid'

// Auto-size each column to the widest value the grid will actually show. Every
// grid in the variant widget is a short fixed-column table sized this same way,
// so they share one definition; a column is either a bare field name or a
// GridColDef whose other keys (headerName, description) pass through.
export function measuredColumns<T extends GridValidRowModel>(
  rows: T[],
  columns: (string | GridColDef<T>)[],
): GridColDef<T>[] {
  return columns.map(column => {
    const col = typeof column === 'string' ? { field: column } : column
    return { ...col, width: measureGridWidth(rows.map(row => row[col.field])) }
  })
}
