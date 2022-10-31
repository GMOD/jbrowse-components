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
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSession, measureGridWidth } from '@jbrowse/core/util'
import { DataGrid, GridCellParams } from '@mui/x-data-grid'

import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'

// icons
import CloseIcon from '@mui/icons-material/Close'
import ClearIcon from '@mui/icons-material/Clear'
import MoreHoriz from '@mui/icons-material/MoreHoriz'

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

export interface InfoArgs {
  target: HTMLElement
  id: string
  conf: AnyConfigurationModel
}

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
  const [info, setInfo] = useState<InfoArgs>()
  const assemblyName = assemblyNames[0]
  const session = getSession(model)
  const tracks = model
    .trackConfigurations(assemblyName)
    .filter(conf => matches(filterText, conf, session))
  const rows = tracks.map(track => ({
    id: track.trackId,
    name: getTrackName(track, session),
    category: readConfObject(track, 'category')?.join(', '),
    conf: track,
  }))
  const infoFields = [
    {
      field: 'name',
      renderCell: (params: GridCellParams) => {
        const { value, id, row } = params
        console.log({ params })
        return (
          <>
            {value}
            <IconButton
              onClick={e =>
                setInfo({
                  target: e.currentTarget,
                  id: id as string,
                  conf: row.conf,
                })
              }
              style={{ padding: 0 }}
              color="secondary"
              data-testid={`htsTrackEntryMenu-${id}`}
            >
              <MoreHoriz />
            </IconButton>
          </>
        )
      },
      width: measureGridWidth(rows.map(r => r.name)) + 15,
    },
    ...['category'].map(e => ({
      field: e,
      // @ts-ignore
      width: measureGridWidth(rows.map(r => r[e])),
    })),
  ]
  const shownTrackIds: string[] = view.tracks.map(
    (t: any) => t.configuration.trackId,
  )

  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      {info ? (
        <JBrowseMenu
          anchorEl={info?.target}
          menuItems={[
            ...(getSession(model).getTrackActionMenuItems?.(info.conf) || []),
          ]}
          onMenuItemClick={(_event, callback) => {
            callback()
            setInfo(undefined)
          }}
          open={Boolean(info)}
          onClose={() => setInfo(undefined)}
        />
      ) : null}
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
