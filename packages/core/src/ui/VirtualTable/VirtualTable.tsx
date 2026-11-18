import { useId, useRef } from 'react'

import { observer } from 'mobx-react'

import { useSearchHighlight } from '../useSearchHighlight.ts'
import VirtualTableHead from './VirtualTableHead.tsx'
import VirtualTableRow from './VirtualTableRow.tsx'
import {
  DEFAULT_COL_WIDTH,
  ROW_HEIGHT,
  useVirtualTableStyles,
} from './tableStyles.ts'
import { useColumnResize } from './useColumnResize.ts'
import { useVirtualRows } from './useVirtualRows.ts'

export interface VirtualTableColumn<R> {
  id: string
  header: string
  /** the header's hover text, the header itself when unset */
  headerTitle?: string
  cell: (row: R) => React.ReactNode
  /** what a header click sorts by; without one the header is a plain label */
  sortValue?: (row: R) => unknown
  title?: (row: R) => string
  align?: 'right'
  /**
   * takes the room the other columns leave rather than a set width, until a
   * drag gives it one
   */
  fill?: boolean
}

export interface VirtualTableLeading<R> {
  width: number
  /** given the rows on show, which a select-all acts on */
  header: (rows: readonly R[]) => React.ReactNode
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
 * sticky header whose sortable columns sort on click and whose columns resize
 * on drag. It holds no row state: the caller hands it the rows in order and
 * the sort to show.
 */
const VirtualTable = observer(function VirtualTable<
  R extends { id: string | number },
>({
  rows,
  columns,
  widths,
  width = 0,
  leading,
  rowHeight = ROW_HEIGHT,
  isRowSelected,
  onRowClick,
  sortField,
  sortAscending,
  onSort,
  resetKey,
  scrollToRowId,
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
  /** each row's height, for rows taller than a line of text */
  rowHeight?: number
  isRowSelected?: (row: R) => boolean
  onRowClick?: (row: R) => void
  sortField: string
  sortAscending: boolean
  /** an empty field is unsorted */
  onSort: (field: string, ascending: boolean) => void
  /** scrolls back to the top when it changes, as a sort change does */
  resetKey?: string
  /**
   * the id of the row to bring into view, which happens when it changes and
   * not when a sort or a filter moves that row
   */
  scrollToRowId?: R['id']
  emptyMessage: React.ReactNode
  /** the search matches to mark in the rows on screen */
  highlightPatterns?: RegExp[]
  testId?: string
}) {
  const { classes } = useVirtualTableStyles()
  const parentRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const highlightName = `jbrowse-table-${useId().replaceAll(/[^a-zA-Z0-9]/g, '')}`
  useSearchHighlight(bodyRef, highlightPatterns, highlightName)
  const leadingWidth = leading?.width ?? 0
  const { startIndex, endIndex, leadingGap, trailingGap, clientWidth } =
    useVirtualRows({
      parentRef,
      rows,
      rowHeight,
      resetKey: JSON.stringify([sortField, sortAscending, resetKey]),
      scrollToId: scrollToRowId,
    })
  const { colWidths, resized, onResizeStart } = useColumnResize(
    widths((clientWidth || width) - leadingWidth),
  )
  const fills = (col: VirtualTableColumn<R>) =>
    col.fill && resized[col.id] === undefined
  const totalWidth =
    leadingWidth +
    columns.reduce(
      (sum, col) => sum + (colWidths[col.id] ?? DEFAULT_COL_WIDTH),
      0,
    )

  return (
    <div ref={parentRef} className={classes.root} data-testid={testId}>
      <table
        className={classes.table}
        style={
          columns.some(col => col.fill) && !columns.some(fills)
            ? { width: totalWidth }
            : { minWidth: totalWidth }
        }
      >
        <colgroup>
          {leading ? <col style={{ width: leadingWidth }} /> : null}
          {columns.map(col => (
            <col
              key={col.id}
              style={
                fills(col)
                  ? undefined
                  : { width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }
              }
            />
          ))}
        </colgroup>
        <VirtualTableHead
          columns={columns}
          hasLeading={!!leading}
          leadingHeader={leading?.header(rows)}
          onResizeStart={onResizeStart}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={onSort}
        />
        <tbody ref={bodyRef}>
          <SpacerRow height={leadingGap} />
          {rows.slice(startIndex, endIndex).map(row => (
            <VirtualTableRow
              key={row.id}
              row={row}
              columns={columns}
              leadingCell={leading?.cell}
              height={rowHeight}
              isRowSelected={isRowSelected}
              onRowClick={onRowClick}
            />
          ))}
          <SpacerRow height={trailingGap} />
        </tbody>
        {rows.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={columns.length + (leading ? 1 : 0)}
                className={classes.emptyCell}
              >
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        ) : null}
      </table>
    </div>
  )
})

export default VirtualTable
