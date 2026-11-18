import VirtualTable from '@jbrowse/core/ui/VirtualTable'
import { toLocale } from '@jbrowse/core/util'
import { cellText, searchHighlightPatterns } from '@jbrowse/core/util/tableText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import LocationCell from './LocationCell.tsx'
import MateCell from './MateCell.tsx'
import SpreadsheetToolbar from './SpreadsheetToolbar.tsx'

import type {
  GridRow,
  SheetColumn,
  SpreadsheetModel,
} from '../SpreadsheetModel.tsx'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  table: {
    flex: 1,
    minHeight: 0,
  },
})

function tableColumn(model: SpreadsheetModel, col: SheetColumn, fill: boolean) {
  const text = (row: GridRow) => cellText(col.value(row))
  return {
    id: col.field,
    header: col.header,
    fill,
    align: col.kind === 'number' ? 'right' : undefined,
    title: text,
    cell:
      col.kind === 'location'
        ? row =>
            row.feature ? (
              <LocationCell model={model} feature={row.feature} />
            ) : (
              'N/A'
            )
        : col.kind === 'mate'
          ? row =>
              row.derived.mate ? (
                <MateCell
                  model={model}
                  locString={row.derived.mate.raw}
                  display={row.derived.mate.display}
                />
              ) : null
          : col.kind === 'number'
            ? row => {
                const value = col.value(row)
                return typeof value === 'number' ? toLocale(value) : text(row)
              }
            : text,
  } satisfies VirtualTableColumn<GridRow>
}

const SpreadsheetTable = observer(function SpreadsheetTable({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { classes } = useStyles()
  const {
    rows,
    shownColumns,
    sortedRows,
    sortColumn,
    sortAscending,
    searchWords,
    filterText,
    svTypeFilter,
    svEventFilter,
    selectedRowIndex,
  } = model
  const sortField = sortColumn?.field ?? ''
  return rows ? (
    <div className={classes.root}>
      <SpreadsheetToolbar model={model} />
      <div className={classes.table}>
        <VirtualTable
          testId="spreadsheet-view-data-grid"
          rows={sortedRows}
          columns={shownColumns.map((col, i) =>
            tableColumn(model, col, i === shownColumns.length - 1),
          )}
          widths={() =>
            Object.fromEntries(shownColumns.map(col => [col.field, col.width]))
          }
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={(field, ascending) => {
            model.setSort(field, ascending)
          }}
          resetKey={JSON.stringify([
            filterText,
            sortField,
            sortAscending,
            [...svTypeFilter],
            svEventFilter,
          ])}
          scrollToKey={model.selectedRowId}
          scrollToIndex={selectedRowIndex}
          isRowSelected={row => row.id === model.selectedRowId}
          onRowClick={row => {
            model.setSelectedFeature(row.feature)
          }}
          highlightPatterns={searchHighlightPatterns(searchWords)}
          emptyMessage={
            rows.length ? 'No rows match the search and filters' : 'No rows'
          }
        />
      </div>
    </div>
  ) : null
})

export default SpreadsheetTable
