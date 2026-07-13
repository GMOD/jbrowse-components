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
  section: {
    marginTop: theme.spacing(2),
  },
  heading: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(0.5),
  },
}))

// Lists both sources that make a track's effective settings differ from its
// configured defaults: per-track edits (`changes`, resettable) and settings
// imposed by a session-wide displayTypeDefault (`displayTypeDefaults`, clearable).
// The two are kept visually separate so a global preference never reads as an
// individual edit of this track.
const TrackSettingsChangesDialog = observer(
  function TrackSettingsChangesDialog({
    changes,
    displayTypeDefaults = [],
    trackName,
    onReset,
    onClearDefaults,
    handleClose,
  }: {
    changes: TrackConfigChange[]
    displayTypeDefaults?: TrackConfigChange[]
    trackName: string
    onReset?: () => void
    onClearDefaults?: () => void
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
          {displayTypeDefaults.length ? (
            <div className={classes.section}>
              <Typography variant="subtitle2" className={classes.heading}>
                Session-wide default
              </Typography>
              <DialogContentText>
                These come from a default you set for all tracks of this type,
                not from an edit to this track.
              </DialogContentText>
              <SettingsChangesTable changes={displayTypeDefaults} />
            </div>
          ) : null}
          {changes.length || displayTypeDefaults.length ? null : (
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
          {displayTypeDefaults.length && onClearDefaults ? (
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                onClearDefaults()
                handleClose()
              }}
            >
              Clear session default
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
