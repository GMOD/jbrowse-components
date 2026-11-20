import { useId } from 'react'

import VirtualTable, {
  CHECKBOX_WIDTH,
  DEFAULT_COL_WIDTH,
} from '@jbrowse/core/ui/VirtualTable'
import { coarseStripHTML } from '@jbrowse/core/util'
import { highlightPatterns } from '@jbrowse/core/util/searchText'
import { observer } from 'mobx-react'

import CheckboxLite from '../../HierarchicalTrackSelectorWidget/components/tree/CheckboxLite.tsx'
import { isUnsupported } from '../../HierarchicalTrackSelectorWidget/util.ts'
import { getShowAllState, setTracksShown } from '../tableSelection.ts'
import { columnFloor, fitColumnWidths } from './fitColumnWidths.ts'
import { getTableColumns } from './getTableColumns.tsx'
import { useTableStyles } from './tableStyles.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel, TrackRow } from '../trackTableModel.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

export type TableColumn = VirtualTableColumn<TrackRow>

const TrackTableGrid = observer(function TrackTableGrid({
  model,
  table,
  fields,
  width,
  emptyMessage = 'No tracks',
}: {
  model: HierarchicalTrackSelectorModel
  table: TrackTableModel
  fields: string[]
  width: number
  emptyMessage?: string
}) {
  const { classes, cx } = useTableStyles()
  const gridId = useId()
  const checkboxId = (rowId: string) => `${gridId}-${encodeURIComponent(rowId)}`
  const columns = getTableColumns({ table, model, fields, checkboxId })
  const {
    narrowed,
    sortedRows,
    activeSortField: sortField,
    sortAscending,
    filterText,
    filters,
    initialWidths,
  } = table

  const { allShown, someShown, toggleAll } = getShowAllState({
    model,
    shownTrackIds: model.shownTrackIds,
    rows: sortedRows,
  })
  const checkboxCell = (row: TrackRow) => {
    const shown = model.shownTrackIds.has(row.id)
    return (
      <CheckboxLite
        id={checkboxId(row.id)}
        className={classes.rowCheckbox}
        checked={shown}
        disabled={isUnsupported(row.name)}
        label={`Show ${coarseStripHTML(row.name)}`}
        onChange={() => {
          setTracksShown(model, [row.id], !shown)
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
      resetKey={JSON.stringify([filterText, [...filters]])}
      sortField={sortField}
      sortAscending={sortAscending}
      onSort={(field, ascending) => {
        table.setSort(field, ascending)
      }}
      leading={{
        width: CHECKBOX_WIDTH,
        header: () =>
          narrowed ? (
            <CheckboxLite
              className={classes.rowCheckbox}
              checked={allShown}
              indeterminate={someShown}
              label="Show all matching tracks"
              onChange={toggleAll}
            />
          ) : null,
        cell: checkboxCell,
      }}
      rowClassName={row =>
        cx(
          classes.trackRow,
          model.selectionSet.has(row.id) && classes.selectedTrackRow,
        )
      }
      emptyMessage={
        table.allRows.length
          ? 'No tracks match the current search and filters'
          : emptyMessage
      }
    />
  )
})

export default TrackTableGrid
