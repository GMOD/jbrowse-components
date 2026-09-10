import { Dialog, SettingsChangesTable } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { TrackConfigChange } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  content: {
    minWidth: 500,
  },
  heading: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(0.5),
  },
}))

// The per-track edits that make a track's effective settings differ from its
// configured defaults.
const TrackSettingsChangesDialog = observer(
  function TrackSettingsChangesDialog({
    changes,
    trackName,
    onReset,
    handleClose,
  }: {
    changes: TrackConfigChange[]
    trackName: string
    onReset?: () => void
    handleClose: () => void
  }) {
    const { classes } = useStyles()
    return (
      <Dialog
        open
        onClose={() => {
          handleClose()
        }}
        title={`Changes to "${trackName}"`}
        maxWidth="md"
      >
        <DialogContent className={classes.content}>
          {changes.length ? (
            <>
              <Typography variant="subtitle2" className={classes.heading}>
                Edited on this track
              </Typography>
              <DialogContentText>
                These settings differ from the track's default configuration.
              </DialogContentText>
              <SettingsChangesTable changes={changes} />
            </>
          ) : null}
          {changes.length ? null : (
            <Typography>This track has no setting changes.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {changes.length && onReset ? (
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                onReset()
                handleClose()
              }}
            >
              Reset to default
            </Button>
          ) : null}
          <Button
            variant="contained"
            onClick={() => {
              handleClose()
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default TrackSettingsChangesDialog
