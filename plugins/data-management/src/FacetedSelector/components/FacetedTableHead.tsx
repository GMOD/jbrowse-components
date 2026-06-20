import Checkbox from '@mui/material/Checkbox'

import { checkboxSx, useFacetedTableStyles } from './facetedTableStyles.ts'

import type { FacetedColumn } from './FacetedDataGrid.tsx'

export default function FacetedTableHead({
  columns,
  allSelected,
  someSelected,
  onSelectAll,
  onResizeStart,
}: {
  columns: FacetedColumn[]
  allSelected: boolean
  someSelected: boolean
  onSelectAll: () => void
  onResizeStart: (colId: string, e: React.MouseEvent) => void
}) {
  const { classes } = useFacetedTableStyles()
  const lastColId = columns.at(-1)?.id
  return (
    <thead className={classes.thead}>
      <tr>
        <th className={classes.checkboxCell}>
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => {
              onSelectAll()
            }}
            slotProps={{ input: { 'aria-label': 'Select all tracks' } }}
            sx={checkboxSx}
          />
        </th>
        {columns.map(col => (
          <th key={col.id} scope="col" className={classes.headerCell}>
            {col.header}
            {col.id !== lastColId ? (
              <div
                className={classes.resizeHandle}
                onMouseDown={e => {
                  onResizeStart(col.id, e)
                }}
              >
                <div className={classes.resizeLine} />
              </div>
            ) : null}
          </th>
        ))}
        <th className={classes.fillerCell} />
      </tr>
    </thead>
  )
}
