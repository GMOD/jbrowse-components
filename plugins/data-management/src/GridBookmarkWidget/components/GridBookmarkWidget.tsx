import React from 'react'
import { observer } from 'mobx-react'

import { makeStyles, Link } from '@material-ui/core'
import { DataGrid, GridCellParams } from '@material-ui/data-grid'

import { getSession } from '@jbrowse/core/util'
import { AbstractViewModel, Region } from '@jbrowse/core/util/types'

import { GridBookmarkModel } from '../model'
import { NavigableViewModel } from '../types'

import DeleteBookmark from './DeleteBookmark'

function navToBookmark(locString: string, views: AbstractViewModel[]) {
  const lgv = views.find(
    view => view.type === 'LinearGenomeView',
  ) as NavigableViewModel

  if (lgv) {
    lgv.navToLocString(locString)
  } else {
    throw new Error('No LGV open')
  }
}

const useStyles = makeStyles(() => ({
  container: {
    margin: 12,
  },
}))

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const classes = useStyles()
  // @ts-ignore
  const { bookmarkedRegions, views } = getSession(model)
  const bookmarkRows = bookmarkedRegions.toJS().map((region: Region) => ({
    ...region,
    id: `${region.refName}:${region.start}..${region.end}`,
    chrom: region.refName,
    delete: `${region.refName}:${region.start}..${region.end}`,
  }))

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
        return (
          <Link
            onClick={() => {
              navToBookmark(value as string, views)
            }}
          >
            {value}
          </Link>
        )
      },
    },
    {
      field: 'delete',
      width: 25,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return <DeleteBookmark locString={value as string} model={model} />
      },
    },
  ]

  return (
    <div className={classes.container}>
      <div style={{ height: 800, width: '100%' }}>
        <DataGrid rows={bookmarkRows} columns={columns} />
      </div>
    </div>
  )
}

export default observer(GridBookmarkWidget)
