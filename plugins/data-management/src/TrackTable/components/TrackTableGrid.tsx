import { useRef } from 'react'

import { observer } from 'mobx-react'

import { useSearchHighlight } from '../../shared/useSearchHighlight.ts'
import { getRowSelectionState } from '../tableSelection.ts'
import TrackTableHead from './TrackTableHead.tsx'
import TrackTableRow from './TrackTableRow.tsx'
import { columnFloor, fitColumnWidths } from './fitColumnWidths.ts'
import { tableMenuItems } from './tableLayout.ts'
import {
  CHECKBOX_WIDTH,
  DEFAULT_COL_WIDTH,
  MENU_CELL_WIDTH,
  ROW_HEIGHT,
  useTableStyles,
} from './tableStyles.ts'
import { useColumnResize } from './useColumnResize.ts'
import { useVirtualRows } from './useVirtualRows.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel, TrackRow } from '../trackTableModel.ts'

export interface TableColumn {
  id: string
  header: string
  cell: (row: TrackRow) => React.ReactNode
}

// Empty <tr> used to offset the virtualized window from the top/bottom of the
// scroll area. Renders nothing when there's no gap to fill.
const SpacerRow = observer(function SpacerRow({ height }: { height: number }) {
  return height > 0 ? (
    <tr style={{ height }}>
      <td />
    </tr>
  ) : null
})

const TrackTableGrid = observer(function TrackTableGrid({
  model,
  table,
  columns,
  width,
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  columns: TableColumn[]
  width: number
}) {
  const { classes } = useTableStyles()
  const {
    useShoppingCart,
    sortedRows,
    sortField,
    sortAscending,
    filterText,
    filters,
    initialWidths,
  } = table

  const parentRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(parentRef, filterText, 'jbrowse-table-search')
  const { items, leadingGap, trailingGap, clientWidth } = useVirtualRows(
    parentRef,
    sortedRows.length,
    ROW_HEIGHT,
    JSON.stringify([filterText, sortField, sortAscending, [...filters]]),
  )
  const available = (clientWidth || width) - CHECKBOX_WIDTH - MENU_CELL_WIDTH
  const { colWidths, onResizeStart } = useColumnResize(
    fitColumnWidths(
      Object.fromEntries(
        columns.map(col => [
          col.id,
          initialWidths[col.id] ?? DEFAULT_COL_WIDTH,
        ]),
      ),
      available,
      id => columnFloor(id, available),
    ),
  )
  const { selectedIds, allSelected, someSelected, toggleAll, toggleRow } =
    getRowSelectionState({
      model,
      useShoppingCart,
      shownTrackIds: model.shownTrackIds,
      selectionSet: model.selectionSet,
      filteredRows: sortedRows,
    })

  return (
    <div ref={parentRef} className={classes.root}>
      <table
        className={classes.table}
        style={{
          minWidth:
            CHECKBOX_WIDTH +
            MENU_CELL_WIDTH +
            columns.reduce(
              (sum, col) => sum + (colWidths[col.id] ?? DEFAULT_COL_WIDTH),
              0,
            ),
        }}
      >
        <colgroup>
          <col style={{ width: CHECKBOX_WIDTH }} />
          {columns.map(col => (
            <col
              key={col.id}
              style={
                col.id === 'name'
                  ? undefined
                  : { width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }
              }
            />
          ))}
          <col style={{ width: MENU_CELL_WIDTH }} />
        </colgroup>
        <TrackTableHead
          columns={columns}
          menuItems={() =>
            tableMenuItems(
              table,
              columns.map(col => col.id),
            )
          }
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={useShoppingCart ? toggleAll : undefined}
          onResizeStart={onResizeStart}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={field => {
            if (sortField !== field) {
              table.setSort(field, true)
            } else if (sortAscending) {
              table.setSort(field, false)
            } else {
              table.setSort('', true)
            }
          }}
        />
        <tbody>
          <SpacerRow height={leadingGap} />
          {items.map(virtualRow => {
            const row = sortedRows[virtualRow.index]!
            return (
              <TrackTableRow
                key={row.id}
                row={row}
                columns={columns}
                selected={selectedIds.has(row.id)}
                onToggle={toggleRow}
              />
            )
          })}
          <SpacerRow height={trailingGap} />
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 2} className={classes.emptyCell}>
                {table.allRows.length
                  ? 'No tracks match the current search and filters'
                  : 'No tracks'}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
})

export default TrackTableGrid
