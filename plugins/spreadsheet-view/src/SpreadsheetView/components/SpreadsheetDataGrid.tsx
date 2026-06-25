import { useEffect } from 'react'

import { MenuItem, TextField } from '@mui/material'
import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import { gridVisibleRowsLookupSelector } from '@mui/x-data-grid/hooks'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel.tsx'

// stable id so the dropdown's filter item is upserted/replaced in place rather
// than stacking alongside the user's own column filters and quick-filter search
const SV_TYPE_FILTER_ID = 'sv-type-quick-filter'

const SpreadsheetDataGrid = observer(function SpreadsheetDataGrid({
  model,
}: {
  model: SpreadsheetModel
}) {
  const {
    rows,
    dataGridColumns,
    visibleColumns,
    svTypeColumnField,
    svTypeOptions,
    svTypeFilter,
  } = model
  const apiRef = useGridApiRef()
  // gate the subscription on the grid actually being rendered: rows start
  // undefined while data loads, so apiRef.current isn't populated on the first
  // effect run — re-run once the grid mounts.
  const gridReady = !!(rows && dataGridColumns)

  // The visible-rows lookup is recomputed by the filter pipeline, which fires
  // `filteredRowsSet` only AFTER `filterModelChange`. Reading the lookup inside
  // onFilterModelChange therefore returns the prior filter's result, so anything
  // downstream of visibleRows (the SV-inspector circular view) lagged a filter
  // behind — or never updated on the first filter. Sync off filteredRowsSet so
  // visibleRows reflects the filter that just ran (covers column filters and the
  // quick-filter search box alike).
  useEffect(() => {
    if (gridReady) {
      return apiRef.current?.subscribeEvent('filteredRowsSet', () => {
        model.setVisibleRows(gridVisibleRowsLookupSelector(apiRef))
      })
    }
    return undefined
  }, [apiRef, model, gridReady])

  // Drive the SVTYPE dropdown through the grid's own filter pipeline (rather
  // than a parallel row filter) so the existing filteredRowsSet handler keeps
  // the circular view / downstream views in sync, and it composes with the
  // user's column filters and quick search instead of replacing them.
  useEffect(() => {
    const api = apiRef.current
    if (gridReady && svTypeColumnField && api) {
      if (svTypeFilter) {
        api.upsertFilterItem({
          id: SV_TYPE_FILTER_ID,
          field: svTypeColumnField,
          operator: 'equals',
          value: svTypeFilter,
        })
      } else {
        api.deleteFilterItem({
          id: SV_TYPE_FILTER_ID,
          field: svTypeColumnField,
          operator: 'equals',
        })
      }
    }
  }, [apiRef, gridReady, svTypeColumnField, svTypeFilter])

  return rows && dataGridColumns ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {svTypeColumnField && svTypeOptions.length > 0 ? (
        <TextField
          select
          size="small"
          label="Filter by SV type"
          value={svTypeFilter ?? ''}
          onChange={event => {
            model.setSvTypeFilter(event.target.value || undefined)
          }}
          sx={{ m: 1, minWidth: 160, alignSelf: 'flex-start' }}
        >
          <MenuItem value="">All</MenuItem>
          {svTypeOptions.map(opt => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          data-testid="spreadsheet-view-data-grid"
          apiRef={apiRef}
          checkboxSelection
          disableRowSelectionOnClick
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
          rows={rows}
          columns={dataGridColumns}
        />
      </div>
    </div>
  ) : null
})

export default SpreadsheetDataGrid
