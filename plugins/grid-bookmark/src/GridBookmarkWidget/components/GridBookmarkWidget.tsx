import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Link,
  IconButton,
  Typography,
  Button,
  makeStyles,
} from '@material-ui/core'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'
import { getSession, assembleLocString, measureText } from '@jbrowse/core/util'
import DeleteIcon from '@material-ui/icons/Delete'
import ViewCompactIcon from '@material-ui/icons/ViewCompact'

import AssemblySelector from './AssemblySelector'
import DeleteBookmarkDialog from './DeleteBookmark'
import DownloadBookmarks from './DownloadBookmarks'
import ImportBookmarks from './ImportBookmarks'
import ClearBookmarks from './ClearBookmarks'
import { GridBookmarkModel } from '../model'
import { navToBookmark } from '../utils'

const useStyles = makeStyles(() => ({
  link: {
    cursor: 'pointer',
  },
}))

// creates a coarse measurement of column width, similar to code in
// BaseFeatureDetails
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const measure = (row: any, col: string) =>
  Math.min(Math.max(measureText(String(row[col]), 14) + 20, 80), 1000)

const BookmarkGrid = observer(
  ({ compact, model }: { model: GridBookmarkModel; compact: boolean }) => {
    const classes = useStyles()
    const [dialogRowNumber, setDialogRowNumber] = useState<number>()
    const { bookmarkedRegions, selectedAssembly } = model
    const { views } = getSession(model)

    const bookmarkRows = bookmarkedRegions
      .toJS()
      .filter(
        region =>
          selectedAssembly === 'all' ||
          region.assemblyName === selectedAssembly,
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

    const columns = [
      {
        field: 'locString',
        headerName: 'bookmark link',
        width: Math.max(...bookmarkRows.map(row => measure(row, 'locString'))),
        renderCell: (params: GridCellParams) => {
          const { value } = params
          return (
            <Link
              className={classes.link}
              onClick={(event: React.MouseEvent) => {
                navToBookmark(value as string, views, model)
                event.preventDefault()
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
              onClick={() => {
                if (value !== null && value !== undefined) {
                  setDialogRowNumber(+value)
                }
              }}
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
            model.updateBookmarkLabel(id as number, value as string)
          }}
          disableSelectionOnClick
        />

        <DeleteBookmarkDialog
          rowNumber={dialogRowNumber}
          model={model}
          onClose={() => setDialogRowNumber(undefined)}
        />
      </>
    )
  },
)

function GridBookmarkWidget({ model }: { model: GridBookmarkModel }) {
  const { selectedAssembly } = model
  const [compact, setCompact] = useState(false)

  return (
    <>
      <AssemblySelector model={model} />
      <DownloadBookmarks model={model} />
      <ImportBookmarks model={model} assemblyName={selectedAssembly} />
      <ClearBookmarks model={model} />
      <Button
        startIcon={<ViewCompactIcon />}
        onClick={() => setCompact(!compact)}
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
