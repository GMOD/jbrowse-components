import { observer } from 'mobx-react'

import { cx } from '../../util/tss-react/index.ts'
import { ROW_HEIGHT, useVirtualTableStyles } from './tableStyles.ts'

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
  height: number
  isRowSelected?: (row: R) => boolean
  onRowClick?: (row: R) => void
}) {
  const { classes } = useVirtualTableStyles()
  const selected = isRowSelected?.(row)
  return (
    <tr
      className={cx(
        selected && classes.selectedRow,
        onRowClick && classes.clickableRow,
        onRowClick && selected && classes.selectedClickableRow,
      )}
      style={{
        height,
        lineHeight: `${Math.min(height, ROW_HEIGHT) - 1}px`,
      }}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={
        onRowClick
          ? () => {
              onRowClick(row)
            }
          : undefined
      }
      onKeyDown={
        onRowClick
          ? event => {
              if (
                event.key === 'Enter' &&
                event.target === event.currentTarget
              ) {
                onRowClick(row)
              }
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
