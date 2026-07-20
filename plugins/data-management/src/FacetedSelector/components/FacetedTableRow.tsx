import { cx } from '@jbrowse/core/util/tss-react'
import Checkbox from '@mui/material/Checkbox'
import { observer } from 'mobx-react'

import { checkboxSx, useFacetedTableStyles } from './facetedTableStyles.ts'

import type { FacetedRow } from '../facetedModel.ts'
import type { FacetedColumn } from './FacetedDataGrid.tsx'

const FacetedTableRow = observer(function FacetedTableRow({
  row,
  columns,
  selected,
  onToggle,
}: {
  row: FacetedRow
  columns: FacetedColumn[]
  selected: boolean
  onToggle: (rowId: string) => void
}) {
  const { classes } = useFacetedTableStyles()
  return (
    <tr className={cx(classes.bodyRow, selected && classes.selectedRow)}>
      <td className={classes.checkboxCell}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={() => {
            onToggle(row.id)
          }}
          slotProps={{ input: { 'aria-label': `Select ${row.name}` } }}
          sx={checkboxSx}
        />
      </td>
      {columns.map(col => (
        <td key={col.id} className={classes.bodyCell}>
          {col.cell(row)}
        </td>
      ))}
      <td className={classes.fillerCell} />
    </tr>
  )
})

export default FacetedTableRow
