import React, { useEffect, useState } from 'react'
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
import {
  DataGrid,
  GRID_CHECKBOX_SELECTION_COL_DEF,
  GridRowId,
  GridRowSelectionModel,
} from '@mui/x-data-grid'
import {
  getSession,
  assembleLocString,
  measureGridWidth,
  measureText,
} from '@jbrowse/core/util'
import { Dialog } from '@jbrowse/core/ui'

// locals
import { navToBookmark } from '../utils'
import {
  GridBookmarkModel,
  IExtendedLabeledRegionModel,
  ILabeledRegionModel,
} from '../model'

const useStyles = makeStyles()(() => ({
  link: {
    cursor: 'pointer',
  },
}))

const BookmarkGrid = ({ model }: { model: GridBookmarkModel }) => {
  const { classes } = useStyles()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogRow, setDialogRow] = useState<IExtendedLabeledRegionModel>()
  const [newLabel, setNewLabel] = useState<string>()
  const { bookmarkedRegions, selectedAssemblies } = model
  const [rowSelectionModel, setRowSelectionModel] =
    useState<GridRowSelectionModel>([])
  const session = getSession(model)
  const { assemblyNames, views } = session

  const bookmarkRows = bookmarkedRegions
    .filter((r: ILabeledRegionModel) =>
      selectedAssemblies.includes(r.assemblyName),
    )
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
                  await navToBookmark(
                    params.value,
                    params.row.assemblyName,
                    views,
                    model,
                  )
                }}
              >
                {params.value}
              </Link>
            ),
          },
          {
            field: 'label',
            headerName: 'Label',
            width:
              bookmarkRows.length > 0
                ? measureGridWidth(bookmarkRows.map(row => row.label))
                : measureText('label'),
            editable: true,
          },
          {
            field: 'assemblyName',
            headerName: 'Assembly',
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
          const target = bookmarkRows[row.id]
          model.updateBookmarkLabel(target, row.label)
          return row
        }}
        onProcessRowUpdateError={e => {
          session.notify(e.message, 'error')
        }}
        checkboxSelection
        onRowSelectionModelChange={newRowSelectionModel => {
          const selectedBookmarks = [] as IExtendedLabeledRegionModel[]
          newRowSelectionModel.forEach((value: GridRowId) => {
            selectedBookmarks.push({ ...bookmarkRows[value as number] })
          })
          model.setSelectedBookmarks(selectedBookmarks)
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
              if (newLabel) {
                const target = bookmarkRows[dialogRow!.id]
                model.updateBookmarkLabel(target, newLabel)
              }
              setNewLabel('')
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
