import { coarseStripHTML } from '@jbrowse/core/util'
import { cx } from '@jbrowse/core/util/tss-react'
import Checkbox from '@mui/material/Checkbox'
import { observer } from 'mobx-react'

import { checkboxSx, useTableStyles } from './tableStyles.ts'
import { getRowStr } from './util.ts'

import type { TrackRow } from '../trackTableModel.ts'
import type { TableColumn } from './TrackTableGrid.tsx'

const TrackTableRow = observer(function TrackTableRow({
  row,
  columns,
  selected,
  onToggle,
}: {
  row: TrackRow
  columns: TableColumn[]
  selected: boolean
  onToggle: (rowId: string) => void
}) {
  const { classes } = useTableStyles()
  return (
    <tr className={cx(classes.bodyRow, selected && classes.selectedRow)}>
      <td className={classes.checkboxCell}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={() => {
            onToggle(row.id)
          }}
          slotProps={{
            input: {
              // a name can carry markup; a screen reader shouldn't read tags
              'aria-label': `Select ${coarseStripHTML(row.name)}`,
            },
          }}
          sx={checkboxSx}
        />
      </td>
      {columns.map(col => (
        <td
          key={col.id}
          className={classes.bodyCell}
          title={coarseStripHTML(
            col.id === 'name' && row.description
              ? `${row.name}\n${row.description}`
              : getRowStr(col.id, row),
          )}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  )
})

export default TrackTableRow
