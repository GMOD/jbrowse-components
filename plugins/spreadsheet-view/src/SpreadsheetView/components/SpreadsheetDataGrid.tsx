import { DataGrid, useGridApiRef } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

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
