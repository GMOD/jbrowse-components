import VirtualTable, {
  useVirtualTableStyles,
} from '@jbrowse/core/ui/VirtualTable'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { cellText } from '../SpreadsheetModel.tsx'
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

function escapeRegExp(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
  const { classes: tableClasses } = useVirtualTableStyles()
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
          scrollToIndex={selectedRowIndex}
          rowClassName={row =>
            row.id === model.selectedRowId
              ? tableClasses.selectedRow
              : undefined
          }
          onRowClick={row => {
            model.setSelectedFeature(row.feature)
          }}
          highlight={{
            name: 'jbrowse-sheet-search',
            patterns: searchWords.map(
              word => new RegExp(escapeRegExp(word), 'giu'),
            ),
          }}
          emptyMessage={
            rows.length ? 'No rows match the search and filters' : 'No rows'
          }
        />
      </div>
    </div>
  ) : null
})

export default SpreadsheetTable
