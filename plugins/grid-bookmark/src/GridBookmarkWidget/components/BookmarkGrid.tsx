import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import {
  assembleLocString,
  getSession,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Link } from '@mui/material'
import { DataGrid, GRID_CHECKBOX_SELECTION_COL_DEF } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { navToBookmark } from '../utils'

import type { GridBookmarkModel } from '../model'

const useStyles = makeStyles()(() => ({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

const BookmarkGrid = observer(function ({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const {
    bookmarks,
    bookmarksWithValidAssemblies,
    selectedAssemblies,
    selectedBookmarks,
  } = model

  const session = getSession(model)
  const selectedSet = new Set(selectedAssemblies)
  const rows = bookmarks
    .filter(r => selectedSet.has(r.assemblyName))
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

  const widths = [
    50,
    Math.max(
      measureText('Bookmark link', 12) + 30,
      measureGridWidth(rows.map(row => row.locString)),
    ),
    Math.max(
      measureText('Label', 12) + 30,
      measureGridWidth(rows.map(row => row.label)),
    ),
    Math.max(
      measureText('Assembly', 12) + 30,
      measureGridWidth(rows.map(row => row.assemblyName)),
    ),
    100,
  ]

  return (
    <DataGridFlexContainer>
      <DataGrid
        density="compact"
        disableRowSelectionOnClick
        rows={rows}
        columns={[
          {
            ...GRID_CHECKBOX_SELECTION_COL_DEF,
            width: widths[0],
          },
          {
            field: 'locString',
            headerName: 'Bookmark link',
            width: widths[1],
            renderCell: ({ value, row }) => (
              <Link
                className={classes.cell}
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
            width: widths[2],
            editable: true,
          },
          {
            field: 'assemblyName',
            headerName: 'Assembly',
            width: widths[3],
          },
          {
            field: 'highlight',
            headerName: 'Highlight',
            width: widths[4],
            renderCell: ({ value, row }) => (
              <ColorPicker
                color={value || 'black'}
                onChange={event => {
                  model.updateBookmarkHighlight(row, event)
                }}
              />
            ),
          },
        ]}
        processRowUpdate={row => {
          const target = rows[row.id]!
          model.updateBookmarkLabel(target, row.label)
          return row
        }}
        onProcessRowUpdateError={e => {
          session.notifyError(`${e}`, e)
        }}
        checkboxSelection
        onRowSelectionModelChange={newRowSelectionModel => {
          if (bookmarksWithValidAssemblies.length > 0) {
            model.setSelectedBookmarks(
              [...newRowSelectionModel.ids].map(value => ({
                ...rows[value as number]!,
              })),
            )
          }
        }}
        rowSelectionModel={{
          type: 'include',
          ids: new Set(selectedBookmarks.map(r => r.id)),
        }}
      />
    </DataGridFlexContainer>
  )
})

export default BookmarkGrid
