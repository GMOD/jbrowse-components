import { observer } from 'mobx-react'

import { cx } from '../../util/tss-react/index.ts'
import { useVirtualTableStyles } from './tableStyles.ts'

import type { VirtualTableColumn } from './VirtualTable.tsx'

const VirtualTableRow = observer(function VirtualTableRow<R>({
  row,
  columns,
  leadingCell,
  height,
  isRowSelected,
  onRowClick,
}: {
  row: R
  columns: VirtualTableColumn<R>[]
  leadingCell?: (row: R) => React.ReactNode
  height?: number
  isRowSelected?: (row: R) => boolean
  onRowClick?: (row: R) => void
}) {
  const { classes } = useVirtualTableStyles()
  return (
    <tr
      className={cx(
        classes.bodyRow,
        onRowClick && classes.clickableRow,
        isRowSelected?.(row) && classes.selectedRow,
      )}
      style={height ? { height } : undefined}
      onClick={
        onRowClick
          ? () => {
              onRowClick(row)
            }
          : undefined
      }
    >
      {leadingCell ? (
        <td className={classes.leadingCell}>{leadingCell(row)}</td>
      ) : null}
      {columns.map(col => (
        <td
          key={col.id}
          className={cx(
            classes.bodyCell,
            col.align === 'right' && classes.alignRight,
          )}
          title={col.title?.(row)}
        >
          {col.cell(row)}
        </td>
      ))}
    </tr>
  )
})

export default VirtualTableRow
