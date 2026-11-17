import { useState } from 'react'

import {
  contigLengthMismatchMessage,
  refNameMismatchMessage,
} from '@jbrowse/core/assemblyManager/assembly'
import { InfoDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import WarningIcon from '@mui/icons-material/Warning'
import { Button, IconButton, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  iconButton: {
    padding: 0,
    color: theme.palette.warning.main,
  },
}))

function warningFor(track: BaseTrackModel, session: AbstractSessionModel) {
  const { refNameMismatch, contigLengthMismatch } = track
  const editable =
    refNameMismatch && session.canEditAssembly
      ? session.canEditAssembly(refNameMismatch.assemblyName)
      : true
  return refNameMismatch
    ? {
        title: 'Reference names do not match the assembly',
        message: refNameMismatchMessage(refNameMismatch, editable),
        editableAssembly: editable ? refNameMismatch.assemblyName : undefined,
      }
    : contigLengthMismatch
      ? {
          title: 'Reference sequence lengths do not match the assembly',
          message: contigLengthMismatchMessage(contigLengthMismatch),
          editableAssembly: undefined,
        }
      : undefined
}

/**
 * The track label's warning for a file that does not fit its assembly: its
 * reference names have nothing in common with the assembly's, so the track
 * draws nothing, or its contig lengths say it was made against another build.
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
  session,
}: {
  track: BaseTrackModel
  session: AbstractSessionModel
}) {
  const { classes } = useStyles()
  const [open, setOpen] = useState(false)
  const warning = warningFor(track, session)
  if (!warning) {
    return null
  }
  const { title, message, editableAssembly } = warning
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
          title={title}
          onClose={() => {
            setOpen(false)
          }}
          actions={
            editableAssembly !== undefined && session.editAssembly ? (
              <Button
                variant="contained"
                onClick={() => {
                  setOpen(false)
                  session.editAssembly?.(editableAssembly)
                }}
              >
                Edit assembly
              </Button>
            ) : null
          }
        >
          <Typography>{message}</Typography>
          <Typography variant="body2" style={{ marginTop: 8 }}>
            The track menu&apos;s &quot;About track&quot; shows every reference
            name the file uses, with the lengths it states.
          </Typography>
        </InfoDialog>
      ) : null}
    </>
  )
})

export default TrackLabelRefNameWarning
