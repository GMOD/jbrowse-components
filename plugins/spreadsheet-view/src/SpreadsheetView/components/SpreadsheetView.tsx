import React, { useState } from 'react'
import { Grid } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import ImportWizard from './ImportWizard'
import Spreadsheet from './Spreadsheet'
import GlobalFilterControls from './GlobalFilterControls'
import ColumnFilterControls from './ColumnFilterControls'
import { SpreadsheetViewModel } from '../models/SpreadsheetView'
import StatusBar from './StatusBar'

const headerHeight = 52
const colFilterHeight = 46
const statusBarHeight = 40

const useStyles = makeStyles()(theme => ({
  header: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    height: headerHeight,
    paddingLeft: theme.spacing(1),
  },
  contentArea: {
    overflow: 'auto',
  },
  resizeHandle: {
    height: 3,
    position: 'absolute',
    bottom: 0,
    left: 0,
    background: theme.palette.action.disabled,
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
}))

export default observer(function ({ model }: { model: SpreadsheetViewModel }) {
  const { classes } = useStyles()
  const {
    spreadsheet,
    filterControls,
    hideFilterControls,
    hideVerticalResizeHandle,
    mode,
    height,
  } = model
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(100)

  return (
    <div>
      {mode !== 'display' || hideFilterControls ? null : (
        <>
          <Grid container direction="row" className={classes.header}>
            <Grid item>
              <GlobalFilterControls model={model} />
            </Grid>
          </Grid>
          {filterControls.columnFilters.map((f, i) => (
            <ColumnFilterControls
              key={`${f.columnNumber}-${i}`}
              viewModel={model}
              filterModel={f}
              columnNumber={f.columnNumber}
              height={colFilterHeight}
            />
          ))}
        </>
      )}

      {mode === 'import' ? (
        <ImportWizard model={model.importWizard} />
      ) : (
        <div className={classes.contentArea}>
          <div
            style={{
              position: 'relative',
              display: mode === 'display' ? undefined : 'none',
            }}
          >
            {spreadsheet ? (
              <Spreadsheet
                page={page}
                rowsPerPage={rowsPerPage}
                model={spreadsheet}
                height={
                  height -
                  headerHeight -
                  filterControls.columnFilters.length * colFilterHeight -
                  statusBarHeight
                }
              />
            ) : null}
          </div>
        </div>
      )}
      {spreadsheet ? (
        <StatusBar
          page={page}
          setPage={setPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          mode={mode}
          spreadsheet={spreadsheet}
        />
      ) : null}
      {hideVerticalResizeHandle ? null : (
        <ResizeHandle
          onDrag={model.resizeHeight}
          className={classes.resizeHandle}
        />
      )}
    </div>
  )
})
