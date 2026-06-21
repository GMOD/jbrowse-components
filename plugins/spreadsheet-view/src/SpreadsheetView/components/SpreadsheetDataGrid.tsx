import { useEffect } from 'react'

import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import { gridVisibleRowsLookupSelector } from '@mui/x-data-grid/hooks'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel.tsx'

const SpreadsheetDataGrid = observer(function SpreadsheetDataGrid({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { rows, dataGridColumns, visibleColumns } = model
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

  return rows && dataGridColumns ? (
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
  ) : null
})

export default SpreadsheetDataGrid
