import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'

import { makeStyles, Typography } from '@material-ui/core'
import { DataGrid } from '@material-ui/data-grid'

import { GridBookmarkModel } from '../model'

const useStyles = makeStyles(theme => ({
  container: {
    margin: 12,
  },
}))

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const classes = useStyles()

  const columns = [
    { field: 'chrom', headerName: 'chrom', width: 100 },
    { field: 'start', headerName: 'start', width: 100 },
    { field: 'end', headerName: 'end', width: 100 },
    { field: 'navLink', headerName: 'link', width: 100 },
  ]

  const rows = [
    {
      id: 1,
      chrom: 1,
      start: 32,
      end: 42,
      navLink: 'yeaareafadfdfdafjdafdafsfdfsdafdfdfsfsfsfds',
    },
  ]

  return (
    <div className={classes.container}>
      <Typography>Grid bookmark widget</Typography>
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid rows={rows} columns={columns} />
      </div>
    </div>
  )
}

export default observer(GridBookmarkWidget)
