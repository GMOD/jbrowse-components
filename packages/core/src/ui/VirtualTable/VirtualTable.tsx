import { useId, useRef } from 'react'

import { observer } from 'mobx-react'

import { useSearchHighlight } from '../useSearchHighlight.ts'
import VirtualTableHead from './VirtualTableHead.tsx'
import VirtualTableRow from './VirtualTableRow.tsx'
import {
  DEFAULT_COL_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  useVirtualTableStyles,
} from './tableStyles.ts'
import { useColumnResize } from './useColumnResize.ts'
import { useVirtualRows } from './useVirtualRows.ts'

export interface VirtualTableColumn<R> {
  id: string
  header: string
  cell: (row: R) => React.ReactNode
  title?: (row: R) => string
  align?: 'right'
  /** takes the room the other columns leave rather than a set width */
  fill?: boolean
}

export interface VirtualTableLeading<R> {
  width: number
  header: React.ReactNode
  cell: (row: R) => React.ReactNode
}

const SpacerRow = observer(function SpacerRow({ height }: { height: number }) {
  return height > 0 ? (
    <tr style={{ height }}>
      <td />
    </tr>
  ) : null
})

/**
 * A table of fixed-height rows that draws only the rows in view, under a
 * sticky header whose columns sort on click and resize on drag. It holds no
 * row state: the caller hands it the rows in order and the sort to show.
 */
const VirtualTable = observer(function VirtualTable<
  R extends { id: string | number },
>({
  rows,
  columns,
  widths,
  width = 0,
  leading,
  isRowSelected,
  onRowClick,
  sortField,
  sortAscending,
  onSort,
  resetKey,
  scrollToKey,
  scrollToIndex,
  emptyMessage,
  highlightPatterns = [],
  testId,
}: {
  rows: readonly R[]
  columns: VirtualTableColumn<R>[]
  /** each column's width, given the px the columns have between them */
  widths: (available: number) => Record<string, number>
  /** the table's width until its scroll container is measured */
  width?: number
  /** a narrow first column, such as a checkbox */
  leading?: VirtualTableLeading<R>
  isRowSelected?: (row: R) => boolean
  onRowClick?: (row: R) => void
  sortField: string
  sortAscending: boolean
  /** an empty field is unsorted */
  onSort: (field: string, ascending: boolean) => void
  /** scrolls back to the top when it changes */
  resetKey: string
  /** names the row to bring into view, which happens when it changes */
  scrollToKey?: string | number
  /** where that row is in `rows`, undefined while it is not among them */
  scrollToIndex?: number
  emptyMessage: React.ReactNode
  /** the search matches to mark in the rows on screen */
  highlightPatterns?: RegExp[]
  testId?: string
}) {
  const { classes } = useVirtualTableStyles()
  const parentRef = useRef<HTMLDivElement>(null)
  const highlightName = `jbrowse-table-${useId().replaceAll(/[^a-zA-Z0-9]/g, '')}`
  useSearchHighlight(parentRef, highlightPatterns, highlightName)
  const leadingWidth = leading?.width ?? 0
  const { items, leadingGap, trailingGap, clientWidth } = useVirtualRows({
    parentRef,
    count: rows.length,
    rowHeight: ROW_HEIGHT,
    resetKey,
    scrollToKey,
    scrollToIndex,
    stickyTop: HEADER_HEIGHT,
  })
  const { colWidths, onResizeStart } = useColumnResize(
    widths((clientWidth || width) - leadingWidth),
  )

  return (
    <div ref={parentRef} className={classes.root} data-testid={testId}>
      <table
        className={classes.table}
        style={{
          minWidth:
            leadingWidth +
            columns.reduce(
              (sum, col) => sum + (colWidths[col.id] ?? DEFAULT_COL_WIDTH),
              0,
            ),
        }}
      >
        <colgroup>
          {leading ? <col style={{ width: leadingWidth }} /> : null}
          {columns.map(col => (
            <col
              key={col.id}
              style={
                col.fill
                  ? undefined
                  : { width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }
              }
            />
          ))}
        </colgroup>
        <VirtualTableHead
          columns={columns}
          hasLeading={!!leading}
          leadingHeader={leading?.header}
          onResizeStart={onResizeStart}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={onSort}
        />
        <tbody>
          <SpacerRow height={leadingGap} />
          {items.map(virtualRow => {
            const row = rows[virtualRow.index]!
            return (
              <VirtualTableRow
                key={row.id}
                row={row}
                columns={columns}
                leadingCell={leading?.cell}
                isRowSelected={isRowSelected}
                onRowClick={onRowClick}
              />
            )
          })}
          <SpacerRow height={trailingGap} />
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (leading ? 1 : 0)}
                className={classes.emptyCell}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
})

export default VirtualTable
