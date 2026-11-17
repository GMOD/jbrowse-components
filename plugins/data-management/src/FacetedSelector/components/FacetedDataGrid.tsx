import { useRef } from 'react'

import { observer } from 'mobx-react'

import { useSearchHighlight } from '../../shared/useSearchHighlight.ts'
import { getRowSelectionState } from '../facetedSelection.ts'
import FacetedTableHead from './FacetedTableHead.tsx'
import FacetedTableRow from './FacetedTableRow.tsx'
import {
  CHECKBOX_WIDTH,
  DEFAULT_COL_WIDTH,
  ROW_HEIGHT,
  useFacetedTableStyles,
} from './facetedTableStyles.ts'
import { columnFloor, fitColumnWidths } from './fitColumnWidths.ts'
import { useColumnResize } from './useColumnResize.ts'
import { useVirtualRows } from './useVirtualRows.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel, FacetedRow } from '../facetedModel.ts'

export interface FacetedColumn {
  id: string
  header: string
  cell: (row: FacetedRow) => React.ReactNode
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

const FacetedDataGrid = observer(function FacetedDataGrid({
  model,
  faceted,
  columns,
  width,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
  columns: FacetedColumn[]
  width: number
}) {
  const { classes } = useFacetedTableStyles()
  const {
    useShoppingCart,
    sortedRows,
    sortField,
    sortAscending,
    query,
    filters,
    initialWidths,
  } = faceted

  const parentRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(parentRef, query, 'jbrowse-faceted-search')
  const { items, leadingGap, trailingGap, clientWidth } = useVirtualRows(
    parentRef,
    sortedRows.length,
    ROW_HEIGHT,
    JSON.stringify([query, sortField, sortAscending, [...filters]]),
  )
  const available = (clientWidth || width) - CHECKBOX_WIDTH
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
          width:
            CHECKBOX_WIDTH +
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
              style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }}
            />
          ))}
          <col />
        </colgroup>
        <FacetedTableHead
          columns={columns}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={useShoppingCart ? toggleAll : undefined}
          onResizeStart={onResizeStart}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={field => {
            if (sortField !== field) {
              faceted.setSort(field, true)
            } else if (sortAscending) {
              faceted.setSort(field, false)
            } else {
              faceted.setSort('', true)
            }
          }}
        />
        <tbody>
          <SpacerRow height={leadingGap} />
          {items.map(virtualRow => {
            const row = sortedRows[virtualRow.index]!
            return (
              <FacetedTableRow
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
                {faceted.allRows.length
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

export default FacetedDataGrid
