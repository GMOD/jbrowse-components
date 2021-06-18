import React from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'

import { makeStyles, Link } from '@material-ui/core'
import { DataGrid, GridCellParams } from '@material-ui/data-grid'

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
    { field: 'assemblyName', headerName: 'assembly', width: 100 },
    {
      field: 'id',
      headerName: 'link',
      width: 100,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return <Link>{value}</Link>
      },
    },
  ]

  return (
    <div className={classes.container}>
      <div style={{ height: 400, width: '100%' }}>
        <DataGrid rows={model.bookmarkArray} columns={columns} />
      </div>
    </div>
  )
}

export default observer(GridBookmarkWidget)
