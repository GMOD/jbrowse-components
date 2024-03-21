import React, { lazy, useState } from 'react'
import { observer } from 'mobx-react'
import { Link } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GRID_CHECKBOX_SELECTION_COL_DEF } from '@mui/x-data-grid'
import {
  getSession,
  assembleLocString,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { useResizeBar } from '@jbrowse/core/ui/useResizeBar'
import ResizeBar from '@jbrowse/core/ui/ResizeBar'
import ColorPicker from '@jbrowse/core/ui/ColorPicker'

// locals
import { navToBookmark } from '../utils'
import { GridBookmarkModel } from '../model'

const EditBookmarkLabelDialog = lazy(
  () => import('./dialogs/EditBookmarkLabelDialog'),
)

const useStyles = makeStyles()(() => ({
  cell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  link: {
    cursor: 'pointer',
  },
}))

const BookmarkGrid = observer(function ({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes, cx } = useStyles()
  const { ref, scrollLeft } = useResizeBar()
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
        assemblyName,
        correspondingObj: region,
        id: index,
        locString: assembleLocString(rest),
      }
    })

  const [widths, setWidths] = useState([
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
  ])

  return (
    <div ref={ref}>
      <ResizeBar
        widths={widths}
        setWidths={setWidths}
        scrollLeft={scrollLeft}
      />
      <DataGrid
        autoHeight
        density="compact"
        rows={rows}
        columns={[
          {
            ...GRID_CHECKBOX_SELECTION_COL_DEF,
            width: widths[0],
          },
          {
            field: 'locString',
            headerName: 'Bookmark link',
            renderCell: ({ value, row }) => (
              <Link
                className={cx(classes.link, classes.cell)}
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
            width: widths[1],
          },
          {
            editable: true,
            field: 'label',
            headerName: 'Label',
            width: widths[2],
          },
          {
            field: 'assemblyName',
            headerName: 'Assembly',
            width: widths[3],
          },
          {
            field: 'highlight',
            headerName: 'Highlight',
            renderCell: ({ value, row }) => (
              <ColorPicker
                color={value || 'black'}
                onChange={event => {
                  model.updateBookmarkHighlight(row, event)
                }}
              />
            ),
            width: widths[4],
          },
        ]}
        onCellDoubleClick={({ row }) => {
          getSession(model).queueDialog(onClose => [
            EditBookmarkLabelDialog,
            { dialogRow: row, model, onClose },
          ])
        }}
        processRowUpdate={row => {
          const target = rows[row.id]
          model.updateBookmarkLabel(target, row.label)
          return row
        }}
        onProcessRowUpdateError={e => session.notifyError(`${e}`, e)}
        checkboxSelection
        onRowSelectionModelChange={newRowSelectionModel => {
          if (bookmarksWithValidAssemblies.length > 0) {
            model.setSelectedBookmarks(
              newRowSelectionModel.map(value => ({
                ...rows[value as number],
              })),
            )
          }
        }}
        rowSelectionModel={selectedBookmarks.map(r => r.id)}
        disableRowSelectionOnClick
      />
    </div>
  )
})

export default BookmarkGrid
