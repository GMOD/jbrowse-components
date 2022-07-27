import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { DataGrid } from '@mui/x-data-grid'
import { AnyConfigurationModel, getConf } from '@jbrowse/core/configuration'

// icons
import CloseIcon from '@mui/icons-material/Close'
import { measureGridWidth } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  content: {
    minWidth: 600,
  },
}))

function WarningDialog({
  tracksWithWarnings,
  handleClose,
}: {
  handleClose: () => void
  tracksWithWarnings: {
    configuration: AnyConfigurationModel
    displays: { warnings: { message: string; effect: string }[] }[]
  }[]
}) {
  const { classes } = useStyles()
  const rows = [] as {
    name: string
    message: string
    effect: string
    id: string
  }[]
  for (let i = 0; i < tracksWithWarnings.length; i++) {
    const track = tracksWithWarnings[i]
    const name = getConf(track, 'name')
    for (let j = 0; j < track.displays[0].warnings.length; j++) {
      const warning = track.displays[0].warnings[j]
      rows.push({ name, ...warning, id: i + '_' + j })
    }
  }
  const columns = [
    { field: 'name' },
    { field: 'message', width: measureGridWidth(rows.map(r => r.message)) },
    { field: 'effect', width: measureGridWidth(rows.map(r => r.effect)) },
  ]
  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      <DialogTitle>
        Dotplot rendered with warnings
        <IconButton
          className={classes.closeButton}
          onClick={() => handleClose()}
          size="large"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.content}>
        <DialogContentText>
          Found warnings while rendering the dotplot. This is often due to
          out-of-bound features that may indicate the wrong assemblies are being
          used. Check that the query and target are configured correctly, and
          that the right assemblies are being compared.
        </DialogContentText>
        <div style={{ height: 600, width: '100%', overflow: 'auto' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            disableSelectionOnClick
            rowHeight={25}
            disableColumnMenu
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default observer(WarningDialog)
