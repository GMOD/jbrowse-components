import React, { Suspense, lazy, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { Link } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  DataGrid,
  GridRowSelectionModel,
  GRID_CHECKBOX_SELECTION_COL_DEF,
} from '@mui/x-data-grid'
import {
  getSession,
  assembleLocString,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'

// locals
import { navToBookmark } from '../utils'
import { GridBookmarkModel, IExtendedLabeledRegionModel } from '../model'

const EditBookmarkLabelDialog = lazy(() => import('./EditBookmarkLabelDialog'))

const useStyles = makeStyles()(() => ({
  link: {
    cursor: 'pointer',
  },
}))

const BookmarkGrid = observer(function ({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogRow, setDialogRow] = useState<IExtendedLabeledRegionModel>()
  const [newLabel, setNewLabel] = useState<string>()
  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>([])
  const {
    bookmarkedRegions,
    selectedAssemblies,
    bookmarksWithValidAssemblies,
  } = model

  const session = getSession(model)
  const bookmarkRows = bookmarkedRegions
    .filter(r => selectedAssemblies.includes(r.assemblyName))
    .map((region, index) => {
      const { assemblyName, ...rest } = region
      return {
        ...region,
        id: index,
        assemblyName,
        locString: assembleLocString(rest),
        correspondingObj: region,
      }
    })

  // reset selections if bookmarked regions change
  // needed especially if bookmarked regions are deleted, then
  // clear selection model
  useEffect(() => {
    setRowSelectionModel([])
  }, [bookmarkedRegions.length])

  return (
    <>
      <DataGrid
        autoHeight
        density="compact"
        rows={bookmarkRows}
        columns={[
          {
            ...GRID_CHECKBOX_SELECTION_COL_DEF,
            minWidth: 40,
            width: 40,
          },
          {
            field: 'locString',
            headerName: 'Bookmark link',
            width: Math.max(
              measureGridWidth(bookmarkRows.map(row => row.locString)),
              measureText('Bookmark link'),
            ),
            renderCell: ({ value, row }) => (
              <Link
                className={classes.link}
                href="#"
                onClick={async event => {
                  event.preventDefault()
                  const { views } = session
                  await navToBookmark(value, row.assemblyName, views, model)
                }}
              >
                {value}
              </Link>
            ),
          },
          {
            field: 'label',
            headerName: 'Label',
            width: Math.max(
              measureGridWidth(bookmarkRows.map(row => row.label)),
              measureText('label'),
            ),
            editable: true,
          },
          ...(selectedAssemblies.length > 1
            ? [
                {
                  field: 'assemblyName',
                  headerName: 'Assembly',
                  width: Math.max(
                    measureGridWidth(bookmarkRows.map(r => r.assemblyName)),
                    measureText('assembly'),
                  ),
                },
              ]
            : []),
        ]}
        onCellDoubleClick={({ row }) => {
          setDialogOpen(true)
          setDialogRow(row)
        }}
        processRowUpdate={row => {
          const target = bookmarkRows[row.id]
          model.updateBookmarkLabel(target, row.label)
          return row
        }}
        onProcessRowUpdateError={e => session.notify(e.message, 'error')}
        checkboxSelection
        onRowSelectionModelChange={newRowSelectionModel => {
          if (bookmarksWithValidAssemblies.length > 0) {
            model.setSelectedBookmarks(
              newRowSelectionModel.map(value => ({
                ...bookmarkRows[value as number],
              })),
            )
            setRowSelectionModel(newRowSelectionModel)
          }
        }}
        rowSelectionModel={rowSelectionModel}
        disableRowSelectionOnClick
      />
      {dialogOpen ? (
        <Suspense fallback={<React.Fragment />}>
          <EditBookmarkLabelDialog
            onClose={() => {
              setDialogRow(undefined)
              setDialogOpen(false)
            }}
            bookmarkRows={bookmarkRows}
            model={model}
            dialogRow={dialogRow}
            newLabel={newLabel}
            setNewLabel={setNewLabel}
          />
        </Suspense>
      ) : null}
    </>
  )
})

export default BookmarkGrid
