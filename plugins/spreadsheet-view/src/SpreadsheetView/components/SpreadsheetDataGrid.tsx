import React from 'react'
import { observer } from 'mobx-react'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'

// locals
import { SpreadsheetModel } from '../models/Spreadsheet'

const SpreadsheetDataGrid = observer(function ({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { rows, visibleColumns, columns } = model

  return (
    <DataGrid
      columnHeaderHeight={35}
      columnVisibilityModel={visibleColumns}
      onColumnVisibilityModelChange={n => {
        model.setVisibleColumns(n)
      }}
      rowHeight={25}
      hideFooter={rows.length < 100}
      slots={{
        toolbar: GridToolbar,
      }}
      slotProps={{
        toolbar: {
          showQuickFilter: true,
        },
      }}
      rows={rows}
      columns={columns}
    />
  )
})

export default SpreadsheetDataGrid
