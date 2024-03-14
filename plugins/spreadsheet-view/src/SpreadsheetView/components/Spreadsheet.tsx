import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import { ErrorMessage, LoadingEllipses, ResizeBar } from '@jbrowse/core/ui'
import { useResizeBar } from '@jbrowse/core/ui/useResizeBar'

// locals
import { SpreadsheetModel } from '../models/Spreadsheet'

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    background: theme.palette.background.paper,
    overflow: 'auto',
  },
}))

const DataTable = observer(function ({ model }: { model: SpreadsheetModel }) {
  const { ref, scrollLeft } = useResizeBar()
  const { data, visible, columns, widths } = model
  const { rows } = data!
  const [error, setError] = useState<unknown>()

  return (
    <div ref={ref}>
      {error ? (
        <ErrorMessage error={error} onReset={() => setError(undefined)} />
      ) : undefined}
      <ResizeBar
        widths={Object.values(widths).map(f => f ?? 100)}
        setWidths={newWidths =>
          model.setWidths(
            Object.fromEntries(
              Object.entries(widths).map((entry, idx) => [
                entry[0],
                newWidths[idx],
              ]),
            ),
          )
        }
        scrollLeft={scrollLeft}
      />
      <DataGrid
        columnHeaderHeight={35}
        columnVisibilityModel={visible}
        onColumnVisibilityModelChange={n => model.setVisible(n)}
        rowHeight={25}
        hideFooter={rows.length < 100}
        slots={{ toolbar: GridToolbar }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
          },
        }}
        rows={rows}
        columns={columns!}
      />
    </div>
  )
})

const Spreadsheet = observer(function ({ model }: { model: SpreadsheetModel }) {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      {model?.data ? (
        <DataTable model={model} />
      ) : (
        <LoadingEllipses variant="h6" />
      )}
    </div>
  )
})

export default Spreadsheet
