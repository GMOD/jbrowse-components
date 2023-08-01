import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Link,
  Typography,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridRowSelectionModel } from '@mui/x-data-grid'
import {
  getSession,
  assembleLocString,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { Dialog } from '@jbrowse/core/ui'

// locals
import { navToBookmark } from '../utils'
import { GridBookmarkModel } from '../model'

const useStyles = makeStyles()(theme => ({
  link: {
    cursor: 'pointer',
  },
}))

const BookmarkGrid = ({ model }: { model: GridBookmarkModel }) => {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogRow, setDialogRow] = useState<any>()
  const [newLabel, setNewLabel] = useState<string>()
  const { bookmarkedRegions, selectedAssembly } = model
  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>(model.selectedBookmarkIndexes || [])
  const { views } = getSession(model)
  const session = getSession(model)

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
        autoHeight
        density="compact"
        rows={bookmarkRows}
        columns={[
          {
            field: 'locString',
            headerName: 'Bookmark link',
            width:
              bookmarkRows.length > 0
                ? measureGridWidth(bookmarkRows.map(row => row.locString))
                : measureText('Bookmark link'),
            renderCell: params => (
              <Link
                className={classes.link}
                href="#"
                onClick={async event => {
                  event.preventDefault()
                  await navToBookmark(params.value, views, model)
                }}
              >
                {params.value}
              </Link>
            ),
          },
          {
            field: 'label',
            width:
              bookmarkRows.length > 0
                ? measureGridWidth(bookmarkRows.map(row => row.label))
                : measureText('label'),
            editable: true,
          },
          {
            field: 'assembly',
            width:
              bookmarkRows.length > 0
                ? measureGridWidth(bookmarkRows.map(row => row.assemblyName))
                : measureText('assembly'),
          },
        ]}
        onCellDoubleClick={({ row }) => {
          setDialogOpen(true)
          setDialogRow(row)
        }}
        /* @ts-ignore */
        processRowUpdate={row => {
          model.updateBookmarkLabel(row.id, row.label)
          setNewLabel(row.label)
          return row
        }}
        onProcessRowUpdateError={e => {
          session.notify(e.message, 'error')
        }}
        checkboxSelection
        onRowSelectionModelChange={newRowSelectionModel => {
          model.setSelectedBookmarkIndexes(
            newRowSelectionModel as Array<number>,
          )
          setRowSelectionModel(newRowSelectionModel)
        }}
        rowSelectionModel={rowSelectionModel}
        /* @ts-ignore */
        disableRowSelectionOnClick
      />

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogRow(undefined)
          setDialogOpen(false)
        }}
        title="Edit bookmark label"
      >
        <DialogContent>
          <Typography>
            Editing label for bookmark{' '}
            <strong>
              {dialogRow?.refName}:{dialogRow?.start}..{dialogRow?.end}
            </strong>
            :
          </Typography>
          <TextField
            fullWidth
            variant="outlined"
            value={newLabel ?? dialogRow?.label}
            onChange={e => {
              setNewLabel(e.target.value)
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              if (newLabel) model.updateBookmarkLabel(dialogRow.id, newLabel)
              setDialogRow(undefined)
              setDialogOpen(false)
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default observer(BookmarkGrid)
