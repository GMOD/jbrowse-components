import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Link, IconButton, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import {
  getSession,
  assembleLocString,
  measureGridWidth,
} from '@jbrowse/core/util'

// icons
import DeleteIcon from '@mui/icons-material/Delete'

// locals
import AssemblySelector from './AssemblySelector'
import DeleteBookmarkDialog from './DeleteBookmark'
import DownloadBookmarks from './DownloadBookmarks'
import ImportBookmarks from './ImportBookmarks'
import ClearBookmarks from './ClearBookmarks'
import { GridBookmarkModel } from '../model'
import { navToBookmark } from '../utils'

const useStyles = makeStyles()(() => ({
  link: {
    cursor: 'pointer',
  },
}))
const BookmarkGrid = observer(({ model }: { model: GridBookmarkModel }) => {
  const { classes } = useStyles()
  const [dialogRowNumber, setDialogRowNumber] = useState<number>()
  const { bookmarkedRegions, selectedAssembly } = model
  const { views } = getSession(model)

  const bookmarkRows = bookmarkedRegions
    .filter(
      r => selectedAssembly === 'all' || r.assemblyName === selectedAssembly,
    )
    .map((region, index) => {
      const { assemblyName, ...rest } = region
      return {
        ...region,
        id: index,
        delete: index,
        locString: assembleLocString(
          selectedAssembly === 'all' ? region : rest,
        ),
      }
    })

  return (
    <>
      <DataGrid
        density="compact"
        rows={bookmarkRows}
        columns={[
          {
            field: 'locString',
            headerName: 'bookmark link',
            width: measureGridWidth(bookmarkRows.map(row => row.locString)),
            renderCell: params => {
              const { value } = params
              return (
                <Link
                  className={classes.link}
                  href="#"
                  onClick={async event => {
                    event.preventDefault()
                    await navToBookmark(value as string, views, model)
                  }}
                >
                  {value}
                </Link>
              )
            },
          },
          {
            field: 'label',
            width: measureGridWidth(bookmarkRows.map(row => row.label)),
            editable: true,
          },
          {
            field: 'delete',
            width: 30,
            renderCell: (params: GridCellParams) => {
              const { value } = params
              return (
                <IconButton
                  data-testid="deleteBookmark"
                  aria-label="delete"
                  onClick={() => {
                    if (value != null) {
                      setDialogRowNumber(+value)
                    }
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )
            },
          },
        ]}
        onCellEditStop={({ id, value }) =>
          model.updateBookmarkLabel(id as number, value)
        }
        disableRowSelectionOnClick
      />

      <DeleteBookmarkDialog
        rowNumber={dialogRowNumber}
        model={model}
        onClose={() => setDialogRowNumber(undefined)}
      />
    </>
  )
})

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const { selectedAssembly } = model

  return (
    <>
      <AssemblySelector model={model} />
      <DownloadBookmarks model={model} />
      <ImportBookmarks model={model} assemblyName={selectedAssembly} />
      <ClearBookmarks model={model} />

      <div style={{ margin: 12 }}>
        <Typography>
          Note: you can double click the <code>label</code> field to add your
          own custom notes
        </Typography>
      </div>
      <div style={{ height: 750, width: '100%' }}>
        <BookmarkGrid model={model} />
      </div>
    </>
  )
}

export default observer(GridBookmarkWidget)
