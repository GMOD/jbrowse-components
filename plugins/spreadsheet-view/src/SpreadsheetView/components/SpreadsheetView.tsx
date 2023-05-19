import React, { useState } from 'react'
import { FormGroup, Grid, TablePagination } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import ImportWizard from './ImportWizard'
import Spreadsheet from './Spreadsheet'
import GlobalFilterControls from './GlobalFilterControls'
import ColumnFilterControls from './ColumnFilterControls'
import RowCountMessage from './RowCountMessage'
import { SpreadsheetModel } from '../models/Spreadsheet'
import { SpreadsheetViewModel } from '../models/SpreadsheetView'

const headerHeight = 52
const colFilterHeight = 46
const statusBarHeight = 40

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
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
  columnFilter: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    height: headerHeight,
    paddingLeft: theme.spacing(1),
  },
  viewControls: {
    margin: 0,
  },
  rowCount: {
    marginLeft: theme.spacing(1),
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: statusBarHeight,
    width: '100%',
    boxSizing: 'border-box',
    borderTop: '1px outset #b1b1b1',
    paddingLeft: theme.spacing(1),
  },
  verticallyCenter: {
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  spacer: {
    flexGrow: 1,
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

function StatusBar({
  page,
  rowsPerPage,
  setPage,
  setRowsPerPage,
  spreadsheet,
  mode,
}: {
  page: number
  mode: string
  spreadsheet: SpreadsheetModel
  rowsPerPage: number
  setPage: (arg: number) => void
  setRowsPerPage: (arg: number) => void
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.statusBar}
      style={{ display: mode === 'display' ? undefined : 'none' }}
    >
      {spreadsheet ? (
        <FormGroup row>
          <div className={classes.verticallyCenter}>
            <RowCountMessage spreadsheet={spreadsheet} />
          </div>
          <div className={classes.spacer} />
          <TablePagination
            rowsPerPageOptions={[10, 25, 100, 1000]}
            count={spreadsheet.rowSet.count}
            component="div"
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={event => {
              setRowsPerPage(+event.target.value)
              setPage(0)
            }}
          />
          <div className={classes.spacer} />
        </FormGroup>
      ) : null}
    </div>
  )
}

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
        <div
          className={classes.contentArea}
          style={{ height: height - headerHeight }}
        >
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
