import React, { useState } from 'react'
import { observer } from 'mobx-react'

import { makeStyles, Link } from '@material-ui/core'
import {
  DataGrid,
  GridCellParams,
  GridEditCellPropsParams,
} from '@material-ui/data-grid'

import { getSession } from '@jbrowse/core/util'
import { AbstractViewModel, Region } from '@jbrowse/core/util/types'

import { GridBookmarkModel } from '../model'
import { NavigableViewModel } from '../types'

import AssemblySelector from './AssemblySelector'
import DeleteBookmark from './DeleteBookmark'
import DownloadBookmarks from './DownloadBookmarks'
import ClearBookmarks from './ClearBookmarks'

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
  const { views } = getSession(model)
  const { bookmarkedRegions, updateBookmarkLabel, assemblies } = model
  const noAssemblies = assemblies.length === 0 ? true : false
  const [selectedAssembly, setSelectedAssembly] = useState(
    noAssemblies ? 'none' : assemblies[0],
  )

  const bookmarkRows = bookmarkedRegions.toJS().map((region: Region) => ({
    ...region,
    id: `${region.refName}:${region.start}..${region.end}`,
    delete: `${region.refName}:${region.start}..${region.end}`,
  }))

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
              navToBookmark(value as string, views)
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
      <AssemblySelector
        assemblies={assemblies}
        selectedAssembly={selectedAssembly}
        setSelectedAssembly={setSelectedAssembly}
      />
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
