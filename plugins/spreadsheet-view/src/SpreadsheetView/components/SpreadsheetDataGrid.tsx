import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { DataGrid, GridToolbar, useGridApiRef } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

// locals
import type { SpreadsheetModel } from '../SpreadsheetModel'

const SpreadsheetDataGrid = observer(function ({
  model,
}: {
  model: SpreadsheetModel
}) {
  const { rows, dataGridColumns, visibleColumns } = model
  const apiRef = useGridApiRef()
  return rows && dataGridColumns ? (
    <DataGrid
      apiRef={apiRef}
      checkboxSelection
      disableRowSelectionOnClick
      columnHeaderHeight={35}
      columnVisibilityModel={visibleColumns}
      onFilterModelChange={() => {
        // might be an x-data-grid undocumented api, if it stops working, can
        // consider using controlled filtering
        setTimeout(() => {
          model.setVisibleRows(apiRef.current.state.visibleRowsLookup)
        })
      }}
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
      columns={dataGridColumns}
    />
  ) : (
    <LoadingEllipses variant="h6" />
  )
})

export default SpreadsheetDataGrid
