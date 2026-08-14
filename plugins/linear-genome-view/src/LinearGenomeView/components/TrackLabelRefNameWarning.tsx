import { useState } from 'react'

import { refNameMismatchMessage } from '@jbrowse/core/assemblyManager/assembly'
import { InfoDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import WarningIcon from '@mui/icons-material/Warning'
import { IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  iconButton: {
    padding: 0,
    color: theme.palette.warning.main,
  },
}))

/**
 * The track label's warning for a file whose reference names have nothing in
 * common with the assembly's — the commonest data-configuration mistake in
 * JBrowse, and until now a silent one: the track draws nothing and reads
 * exactly like a track with no features in view.
 *
 * The label rather than the display chrome, deliberately. The chrome's states
 * are `displayPhase`'s, which are mutually exclusive and two of which replace
 * the display's subtree; a mismatch is neither an error to retry nor a phase to
 * be in, and routing it through `model.error` would put a red banner and a dead
 * Retry over a track that, if the check is ever wrong, is drawing fine. This
 * sits next to the track's own close/minimize buttons, costs the display
 * nothing, and reaches every track type at once.
 *
 * The tooltip is the summary and the dialog is the disclosure — a hover nobody
 * performs is not a way of telling someone their data is misconfigured.
 */
const TrackLabelRefNameWarning = observer(function TrackLabelRefNameWarning({
  track,
}: {
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const { refNameMismatch } = track
  if (!refNameMismatch) {
    return null
  }
  const message = refNameMismatchMessage(refNameMismatch)
  return (
    <>
      <IconButton
        onClick={() => {
          setOpen(true)
        }}
        className={classes.iconButton}
        title={message}
        data-testid={`track-refname-warning-${track.trackId}`}
      >
        <WarningIcon fontSize="small" />
      </IconButton>
      {open ? (
        <InfoDialog
          open
          title="Reference names do not match the assembly"
          onClose={() => {
            setOpen(false)
          }}
        >
          <Typography>{message}</Typography>
          <Typography variant="body2" style={{ marginTop: 8 }}>
            The track menu&apos;s &quot;About track&quot; shows every reference
            name the file uses.
          </Typography>
        </InfoDialog>
      ) : null}
    </>
  )
})

export default TrackLabelRefNameWarning
