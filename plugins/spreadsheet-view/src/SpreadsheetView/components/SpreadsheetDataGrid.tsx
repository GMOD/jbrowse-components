import { useEffect } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Chip, MenuItem, TextField } from '@mui/material'
import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import {
  gridQuickFilterValuesSelector,
  gridVisibleRowsLookupSelector,
} from '@mui/x-data-grid/hooks'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel.tsx'

const useStyles = makeStyles()(theme => ({
  // not the grid's row selection, which is the reader's multi-select
  selectedRow: {
    background: theme.palette.action.selected,
  },
}))

function disposeAll(disposers: (() => void)[]) {
  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}

const SpreadsheetDataGrid = observer(function SpreadsheetDataGrid({
  model,
}: {
  model: SpreadsheetModel
}) {
  const {
    rows,
    gridRows,
    dataGridColumns,
    visibleColumns,
    gridFacets,
    filterText,
    visibleRows,
    selectedRowId,
  } = model
  const { classes } = useStyles()
  const apiRef = useGridApiRef()
  // apiRef is unset until the grid mounts
  const gridReady = !!(rows && dataGridColumns)

  // grid -> model. Declared before the model -> grid effect, whose search push
  // fires `filteredRowsSet` synchronously
  useEffect(() => {
    const api = apiRef.current
    if (!gridReady || !api) {
      return undefined
    }
    const syncVisibleRows = () => {
      model.setVisibleRows(gridVisibleRowsLookupSelector(apiRef))
    }
    syncVisibleRows()
    return disposeAll([
      // `filterModelChange` fires before the lookup is recomputed
      api.subscribeEvent('filteredRowsSet', syncVisibleRows),
      api.subscribeEvent('filterModelChange', filterModel => {
        model.setFilterText(
          filterModel.quickFilterValues?.join(' ') || undefined,
        )
      }),
    ])
  }, [apiRef, model, gridReady])

  // model -> grid, as autoruns. The search push compares against the grid's
  // current value, so the round trip settles and a remount re-applies
  useEffect(() => {
    const api = apiRef.current
    if (!gridReady || !api) {
      return undefined
    }
    return disposeAll([
      autorun(() => {
        const wanted = model.filterText?.split(' ').filter(Boolean) ?? []
        const current = gridQuickFilterValuesSelector(apiRef) ?? []
        if (current.join(' ') !== wanted.join(' ')) {
          api.setQuickFilterValues(wanted)
        }
      }),
      // a chord click's row is often far down the virtualized grid
      autorun(() => {
        const { selectedRowId } = model
        if (selectedRowId !== undefined) {
          const rowIndex = api.getRowIndexRelativeToVisibleRows(selectedRowId)
          // -1 for a row the filter has since left out
          if (rowIndex >= 0) {
            api.scrollToIndexes({ rowIndex })
          }
        }
      }),
    ])
  }, [apiRef, model, gridReady])

  return rows && dataGridColumns ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {gridFacets.length || filterText ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: 8,
          }}
        >
          {gridFacets.map(({ id, label, selected, options }) => (
            <TextField
              key={id}
              select
              variant="outlined"
              size="small"
              label={label}
              value={options.some(o => o.key === selected) ? selected : ''}
              onChange={event => {
                model.setGridFacet(id, event.target.value || undefined)
              }}
              sx={{ minWidth: 160 }}
              slotProps={{ htmlInput: { 'data-testid': id } }}
            >
              <MenuItem value="">All</MenuItem>
              {options.map(opt => (
                <MenuItem key={opt.key} value={opt.key}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          ))}
          {/* the toolbar's search collapses to a magnifier, which would leave
              a restored search invisible */}
          {filterText ? (
            <Chip
              size="small"
              label={`Search "${filterText}": showing ${visibleRows?.length ?? 0} of ${rows.length} rows`}
              onDelete={() => {
                model.setFilterText(undefined)
              }}
            />
          ) : null}
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          data-testid="spreadsheet-view-data-grid"
          apiRef={apiRef}
          columnHeaderHeight={35}
          columnVisibilityModel={visibleColumns}
          onColumnVisibilityModelChange={n => {
            model.setVisibleColumns(n)
          }}
          rowHeight={25}
          hideFooter={rows.length < 100}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
            },
          }}
          showToolbar
          rows={gridRows}
          columns={dataGridColumns}
          onRowClick={({ row }) => {
            model.setSelectedFeature(row.feature)
          }}
          getRowClassName={({ id }) =>
            id === selectedRowId ? classes.selectedRow : ''
          }
        />
      </div>
    </div>
  ) : null
})

export default SpreadsheetDataGrid
