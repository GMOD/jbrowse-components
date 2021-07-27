import React from 'react'
import { observer } from 'mobx-react'

import { makeStyles, Link } from '@material-ui/core'
import {
  DataGrid,
  GridCellParams,
  GridEditCellPropsParams,
} from '@material-ui/data-grid'

import { getSession } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'

import { GridBookmarkModel } from '../model'
import { navToBookmark } from '../utils'

import AssemblySelector from './AssemblySelector'
import DeleteBookmark from './DeleteBookmark'
import DownloadBookmarks from './DownloadBookmarks'
import ClearBookmarks from './ClearBookmarks'

const useStyles = makeStyles(() => ({
  container: {
    margin: 12,
  },
}))

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const classes = useStyles()
  const { views } = getSession(model)
  const { bookmarkedRegions, updateBookmarkLabel, selectedAssembly } = model

  const bookmarkRows = bookmarkedRegions
    .toJS()
    .map((region: Region) => ({
      ...region,
      id: `${region.refName}:${region.start}..${region.end}`,
      delete: `${region.refName}:${region.start}..${region.end}`,
    }))
    .filter(region => {
      if (selectedAssembly === 'all') {
        return true
      } else {
        return region.assemblyName === selectedAssembly
      }
    })

  const handleEditCellChangeCommitted = React.useCallback(
    ({ id, props }: GridEditCellPropsParams) => {
      const data = props
      const { value } = data
      bookmarkRows.forEach(row => {
        if (row.id === id) {
          updateBookmarkLabel(id, value as string)
        }
      })
    },
    [bookmarkRows, updateBookmarkLabel],
  )

  const columns = [
    {
      field: 'id',
      headerName: 'bookmark link',
      width: 200,
      renderCell: (params: GridCellParams) => {
        const { value } = params
        return (
          <Link
            onClick={() => {
              navToBookmark(value as string, views, model)
            }}
          >
            {value}
          </Link>
        )
      },
    },
    {
      field: 'label',
      width: 110,
      editable: true,
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
      <AssemblySelector model={model} />
      <DownloadBookmarks model={model} />
      <ClearBookmarks model={model} />
      <div style={{ height: 800, width: '100%' }}>
        <DataGrid
          rows={bookmarkRows}
          columns={columns}
          onEditCellChangeCommitted={handleEditCellChangeCommitted}
          disableSelectionOnClick
        />
      </div>
    </div>
  )
}

export default observer(GridBookmarkWidget)
