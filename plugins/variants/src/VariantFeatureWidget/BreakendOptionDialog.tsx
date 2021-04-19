/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  FormControlLabel,
  Checkbox,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { getSnapshot } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  block: {
    display: 'block',
  },
}))

function BreakendOptionDialog({
  model,
  handleClose,
  feature,
  viewType,
}: {
  model: any
  handleClose: () => void
  feature: Feature
  viewType: any
}) {
  const classes = useStyles()
  const [copyTracks, setCopyTracks] = useState(true)
  const [mirrorTracks, setMirrorTracks] = useState(true)

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Breakpoint split view options
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => {
              handleClose()
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />

      <DialogContent>
        <FormControlLabel
          className={classes.block}
          control={
            <Checkbox
              checked={copyTracks}
              onChange={() => setCopyTracks(val => !val)}
            />
          }
          label="Copy tracks into the new view"
        />

        <FormControlLabel
          className={classes.block}
          control={
            <Checkbox
              checked={mirrorTracks}
              onChange={() => setMirrorTracks(val => !val)}
            />
          }
          label="Mirror tracks vertically in vertically stacked view"
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const { view } = model
            const session = getSession(model)

            const viewSnapshot = viewType.snapshotFromBreakendFeature(
              feature,
              view,
            )
            viewSnapshot.views[0].offsetPx -= view.width / 2 + 100
            viewSnapshot.views[1].offsetPx -= view.width / 2 + 100
            viewSnapshot.featureData = feature
            const viewTracks: any = getSnapshot(view.tracks)
            viewSnapshot.views[0].tracks = viewTracks
            viewSnapshot.views[1].tracks = mirrorTracks
              ? viewTracks.slice().reverse()
              : viewTracks

            session.addView('BreakpointSplitView', viewSnapshot)

            handleClose()
          }}
          variant="contained"
          color="primary"
          autoFocus
        >
          OK
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="secondary"
          variant="contained"
          autoFocus
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
export default observer(BreakendOptionDialog)
