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
import { useColumnResize } from './useColumnResize.ts'
import { useVirtualRows } from './useVirtualRows.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel, FacetedRow } from '../facetedModel.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface FacetedColumn {
  id: string
  header: string
  cell: (row: FacetedRow) => React.ReactNode
}

// Empty <tr> used to offset the virtualized window from the top/bottom of the
// scroll area. Renders nothing when there's no gap to fill.
function SpacerRow({ height }: { height: number }) {
  return height > 0 ? (
    <tr style={{ height }}>
      <td />
    </tr>
  ) : null
}

const FacetedDataGrid = observer(function FacetedDataGrid({
  model,
  faceted,
  columns,
  shownTrackIds,
  selection,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
  columns: FacetedColumn[]
  shownTrackIds: Set<string>
  selection: AnyConfigurationModel[]
}) {
  const { classes } = useFacetedTableStyles()
  const {
    useShoppingCart,
    sortedRows,
    sortField,
    sortAscending,
    visible,
    filterText,
    initialWidths,
  } = faceted

  const visibleColumns = columns.filter(col => visible[col.id] !== false)
  const { colWidths, onResizeStart } = useColumnResize(initialWidths)
  const { selectedIds, allSelected, someSelected, toggleAll, toggleRow } =
    getRowSelectionState({
      model,
      useShoppingCart,
      shownTrackIds,
      selection,
      filteredRows: sortedRows,
    })

  const parentRef = useRef<HTMLDivElement>(null)
  useSearchHighlight(parentRef, filterText, 'jbrowse-faceted-search')
  const { items, leadingGap, trailingGap } = useVirtualRows(
    parentRef,
    sortedRows.length,
    ROW_HEIGHT,
  )

  return (
    <div ref={parentRef} className={classes.root}>
      <table className={classes.table}>
        <colgroup>
          <col style={{ width: CHECKBOX_WIDTH }} />
          {visibleColumns.map(col => (
            <col
              key={col.id}
              style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }}
            />
          ))}
          <col />
        </colgroup>
        <FacetedTableHead
          columns={visibleColumns}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={toggleAll}
          onResizeStart={onResizeStart}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={field => {
            faceted.setSort(field, sortField === field ? !sortAscending : true)
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
                columns={visibleColumns}
                selected={selectedIds.has(row.id)}
                onToggle={toggleRow}
              />
            )
          })}
          <SpacerRow height={trailingGap} />
          {sortedRows.length === 0 ? (
            <tr>
              <td
                colSpan={visibleColumns.length + 2}
                className={classes.emptyCell}
              >
                No tracks match the current search and filters
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
})

export default FacetedDataGrid
