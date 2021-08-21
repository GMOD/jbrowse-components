import React, { useState } from 'react'
import { observer } from 'mobx-react'

import { Link, IconButton, Typography, Button } from '@material-ui/core'
import { DataGrid, GridCellParams } from '@material-ui/data-grid'

import { getSession, assembleLocString, measureText } from '@jbrowse/core/util'

import { GridBookmarkModel } from '../model'
import { navToBookmark } from '../utils'

import DeleteIcon from '@material-ui/icons/Delete'
import ViewCompactIcon from '@material-ui/icons/ViewCompact'
import AssemblySelector from './AssemblySelector'
import DeleteBookmarkDialog from './DeleteBookmark'
import DownloadBookmarks from './DownloadBookmarks'
import ClearBookmarks from './ClearBookmarks'

// creates a coarse measurement of column width, similar to code in BaseFeatureDetails
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const measure = (row: any, col: string) =>
  Math.min(Math.max(measureText(String(row[col]), 14) + 20, 80), 1000)

const BookmarkGrid = observer(
  ({ compact, model }: { model: GridBookmarkModel; compact: boolean }) => {
    const [dialogOpen, setDialogOpen] = useState<string>()
    const { bookmarkedRegions, updateBookmarkLabel, selectedAssembly } = model
    const { views } = getSession(model)

    const bookmarkRows = bookmarkedRegions
      .toJS()
      .map(region => {
        const { assemblyName, ...rest } = region
        const displayedId = assembleLocString(
          selectedAssembly === 'all' ? region : rest,
        )
        const id = assembleLocString(region)
        return {
          ...region,
          displayedId,
          id,
          delete: id,
        }
      })
      .filter(
        region =>
          selectedAssembly === 'all' ||
          region.assemblyName === selectedAssembly,
      )

    const columns = [
      {
        field: 'displayedId',
        headerName: 'bookmark link',
        width: Math.max(...bookmarkRows.map(row => measure(row, 'id'))),
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
        width: Math.max(
          100,
          Math.max(...bookmarkRows.map(row => measure(row, 'label'))),
        ),
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
              onClick={() => setDialogOpen(value as string)}
              style={{ padding: 0 }}
            >
              <DeleteIcon />
            </IconButton>
          )
        },
      },
    ]

    return (
      <>
        <DataGrid
          rows={bookmarkRows}
          rowHeight={compact ? 25 : undefined}
          headerHeight={compact ? 25 : undefined}
          columns={columns}
          onCellEditCommit={args => {
            const { value, id } = args
            bookmarkRows.forEach(row => {
              if (row.id === id) {
                updateBookmarkLabel(id, value as string)
              }
            })
          }}
          disableSelectionOnClick
        />

        <DeleteBookmarkDialog
          locString={dialogOpen}
          model={model}
          onClose={() => {
            setDialogOpen(undefined)
          }}
        />
      </>
    )
  },
)

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const [compact, setCompact] = useState(false)

  return (
    <>
      <AssemblySelector model={model} />
      <DownloadBookmarks model={model} />
      <ClearBookmarks model={model} />
      <Button
        startIcon={<ViewCompactIcon />}
        onClick={() => {
          setCompact(!compact)
        }}
      >
        Compact
      </Button>
      <div style={{ margin: 12 }}>
        <Typography>
          Note: you can double click the <code>label</code> field to add your
          own custom notes
        </Typography>
      </div>
      <div style={{ height: 750, width: '100%' }}>
        <BookmarkGrid model={model} compact={compact} />
      </div>
    </>
  )
}

export default observer(GridBookmarkWidget)
