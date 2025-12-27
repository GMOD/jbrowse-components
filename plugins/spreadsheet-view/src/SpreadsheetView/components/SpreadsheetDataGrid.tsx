import { startTransition } from 'react'

import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { SpreadsheetModel } from '../SpreadsheetModel'

const SpreadsheetDataGrid = observer(function SpreadsheetDataGrid({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { rows, dataGridColumns, visibleColumns } = model
  const apiRef = useGridApiRef()
  return rows && dataGridColumns ? (
    <DataGrid
      data-testid="spreadsheet-view-data-grid"
      apiRef={apiRef}
      checkboxSelection
      disableRowSelectionOnClick
      columnHeaderHeight={35}
      columnVisibilityModel={visibleColumns}
      onFilterModelChange={() => {
        startTransition(() => {
          if (apiRef.current) {
            model.setVisibleRows(apiRef.current.state.visibleRowsLookup)
          }
        })
      }}
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
