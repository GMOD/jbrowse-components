import React from 'react'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import { LoadingEllipses } from '@jbrowse/core/ui'

// locals
import type SpreadsheetStateModel from '../models/Spreadsheet'
import DataTable from './DataTable'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    background: theme.palette.background.paper,
    overflow: 'auto',
  },
}))

const Spreadsheet = observer(function ({
  model,
  height,
  page,
  rowsPerPage,
}: {
  model: SpreadsheetModel
  height: number
  page: number
  rowsPerPage: number
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.root} style={{ height }}>
      {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        model.rowSet.isLoaded && model.initialized ? (
          <DataTable model={model} page={page} rowsPerPage={rowsPerPage} />
        ) : (
          <LoadingEllipses variant="h6" />
        )
      }
    </div>
  )
})

export default Spreadsheet
