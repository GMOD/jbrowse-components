import VirtualTable, { DEFAULT_COL_WIDTH } from '@jbrowse/core/ui/VirtualTable'
import { coarseStripHTML } from '@jbrowse/core/util'
import { highlightPatterns } from '@jbrowse/core/util/searchText'
import Checkbox from '@mui/material/Checkbox'
import { observer } from 'mobx-react'

import CheckboxLite from '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx'
import { isUnsupported } from '../../HierarchicalTrackSelectorWidget/util.ts'
import { getRowSelectionState, setTracksSelected } from '../tableSelection.ts'
import { columnFloor, fitColumnWidths } from './fitColumnWidths.ts'
import { CHECKBOX_WIDTH, checkboxSx, useTableStyles } from './tableStyles.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel, TrackRow } from '../trackTableModel.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

export type TableColumn = VirtualTableColumn<TrackRow>

const TrackTableGrid = observer(function TrackTableGrid({
  model,
  table,
  columns,
  width,
  emptyMessage = 'No tracks',
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  columns: TableColumn[]
  width: number
  emptyMessage?: string
}) {
  const { classes } = useTableStyles()
  const {
    useShoppingCart,
    sortedRows,
    activeSortField: sortField,
    sortAscending,
    filterText,
    filters,
    initialWidths,
  } = table

  const { allSelected, someSelected, toggleAll } = getRowSelectionState({
    model,
    useShoppingCart,
    shownTrackIds: model.shownTrackIds,
    selectionSet: model.selectionSet,
    filteredRows: sortedRows,
  })
  const isSelected = (row: TrackRow) =>
    (table.useShoppingCart ? model.selectionSet : model.shownTrackIds).has(
      row.id,
    )
  const checkboxCell = (row: TrackRow) => {
    const selected = isSelected(row)
    return (
      <CheckboxLite
        className={classes.rowCheckbox}
        checked={selected}
        disabled={isUnsupported(row.name)}
        label={`Select ${coarseStripHTML(row.name)}`}
        onChange={() => {
          setTracksSelected(model, [row.id], !selected, table.useShoppingCart)
        }}
      />
    )
  }

  return (
    <VirtualTable
      highlightPatterns={highlightPatterns(filterText)}
      rows={sortedRows}
      columns={columns}
      width={width}
      widths={available =>
        fitColumnWidths(
          Object.fromEntries(
            columns.map(col => [
              col.id,
              initialWidths[col.id] ?? DEFAULT_COL_WIDTH,
            ]),
          ),
          available,
          id => columnFloor(id, available),
        )
      }
      resetKey={JSON.stringify([
        filterText,
        sortField,
        sortAscending,
        [...filters],
      ])}
      sortField={sortField}
      sortAscending={sortAscending}
      onSort={(field, ascending) => {
        table.setSort(field, ascending)
      }}
      leading={{
        width: CHECKBOX_WIDTH,
        header: useShoppingCart ? (
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => {
              toggleAll()
            }}
            slotProps={{ input: { 'aria-label': 'Select all tracks' } }}
            sx={checkboxSx}
          />
        ) : null,
        cell: checkboxCell,
      }}
      isRowSelected={isSelected}
      emptyMessage={
        table.allRows.length
          ? 'No tracks match the current search and filters'
          : emptyMessage
      }
    />
  )
})

export default TrackTableGrid
