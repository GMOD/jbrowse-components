import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSession, measureGridWidth } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { DataGrid } from '@mui/x-data-grid'

// icons
import CloseIcon from '@mui/icons-material/Close'
import ClearIcon from '@mui/icons-material/Clear'

// locals
import { matches, HierarchicalTrackSelectorModel } from '../model'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

function FacetedDlg({
  handleClose,
  model,
}: {
  handleClose: () => void
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { assemblyNames, view } = model
  const [filterText, setFilterText] = useState('')
  const assemblyName = assemblyNames[0]
  const session = getSession(model)
  const tracks = model
    .trackConfigurations(assemblyName)
    .filter(conf => matches(filterText, conf, session))
  const rows = tracks.map(track => ({
    id: track.trackId,
    name: getTrackName(track, session),
    category: readConfObject(track, 'category')?.join(', '),
  }))
  const infoFields = ['name', 'category'].map(e => ({
    field: e,
    // @ts-ignore
    width: measureGridWidth(rows.map(r => r[e])),
  }))
  const shownTrackIds: string[] = view.tracks.map(
    (t: any) => t.configuration.trackId,
  )

  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      <DialogTitle>
        Track selector
        <IconButton
          className={classes.closeButton}
          onClick={() => handleClose()}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          label="Filter tracks"
          value={filterText}
          onChange={event => setFilterText(event.target.value)}
          fullWidth
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton color="secondary" onClick={() => setFilterText('')}>
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <div
          style={{
            height: window.innerHeight * 0.75,
            width: window.innerWidth * 0.75,
            overflow: 'auto',
          }}
        >
          <DataGrid
            rows={rows}
            checkboxSelection
            disableSelectionOnClick
            onSelectionModelChange={userSelectedIds => {
              const arr1 = shownTrackIds
              const arr2 = userSelectedIds
              // synchronize the user selection with the view
              // see share https://stackoverflow.com/a/33034768/2129219
              let tracksToHide = arr1.filter(x => !arr2.includes(x))
              let tracksToShow = arr2.filter(x => !arr1.includes(x as string))
              transaction(() => {
                tracksToHide.map(t => view.hideTrack(t))
                tracksToShow.map(t => view.showTrack(t))
              })
            }}
            selectionModel={shownTrackIds}
            columns={infoFields}
            rowHeight={25}
            disableColumnMenu
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => handleClose()}
          variant="contained"
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(FacetedDlg)
