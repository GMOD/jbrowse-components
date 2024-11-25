import React from 'react'
import { FormGroup, TablePagination } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import RowCountMessage from './RowCountMessage'
import type { SpreadsheetModel } from '../models/Spreadsheet'

const statusBarHeight = 40

const useStyles = makeStyles()(theme => ({
  statusBar: {
    height: statusBarHeight,
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
}))

const StatusBar = observer(function StatusBar({
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
          onPageChange={(_, newPage) => {
            setPage(newPage)
          }}
          onRowsPerPageChange={event => {
            setRowsPerPage(+event.target.value)
            setPage(0)
          }}
        />
        <div className={classes.spacer} />
      </FormGroup>
    </div>
  )
})

export default StatusBar
