import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { containingLgv } from '../../LinearGenomeView/containingLgv.ts'

import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  iconButton: {
    padding: 0,
  },
})

// Keyed by trackId, not by the track's display name or by the model id: the
// name is config the user can change and the model id is minted per session, so
// neither survives being written into a test or a screenshot spec. The only
// other handle these buttons offered was `title`, which is shared by every
// track's copy of the button — so reaching ONE of them meant walking up to the
// Paper the label and the rendering container share and matching that
// container's testid through `:has()`. That worked and nobody should have to
// write it.
export const TrackLabelCloseButton = observer(function TrackLabelCloseButton({
  track,
}: {
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const view = containingLgv(track)
  return (
    <IconButton
      onClick={() => view.hideTrack(track.trackId)}
      className={classes.iconButton}
      title="close this track"
      data-testid={`track-close-${track.trackId}`}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  )
})

export const TrackLabelMinimizeButton = observer(
  function TrackLabelMinimizeButton({ track }: { track: BaseTrackModel }) {
    const { classes } = useStyles()
    const { minimized } = track
    return (
      <IconButton
        onClick={() => {
          track.setMinimized(!minimized)
        }}
        className={classes.iconButton}
        title={minimized ? 'restore track' : 'minimize track'}
        // one testid whichever way it is pointing, so a test that minimizes and
        // restores does not have to know which state it is in to find it
        data-testid={`track-minimize-${track.trackId}`}
      >
        {minimized ? <ArrowRightIcon /> : <ArrowDropDownIcon />}
      </IconButton>
    )
  },
)
