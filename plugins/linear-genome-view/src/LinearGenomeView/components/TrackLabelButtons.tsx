import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ArrowRightIcon from '@mui/icons-material/ArrowRight'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()({
  iconButton: {
    padding: 0,
  },
})

export const TrackLabelCloseButton = observer(function TrackLabelCloseButton({
  track,
}: {
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(track) as LinearGenomeViewModel
  return (
    <IconButton
      onClick={() => view.hideTrack(track.trackId)}
      className={classes.iconButton}
      title="close this track"
    >
      <CloseIcon fontSize="small" />
    </IconButton>
  )
})

export const TrackLabelMinimizeButton = observer(function TrackLabelMinimizeButton({
  track,
}: {
  track: BaseTrackModel
}) {
  const { classes } = useStyles()
  const { minimized } = track
  return (
    <IconButton
      onClick={() => { track.setMinimized(!minimized) }}
      className={classes.iconButton}
      title={minimized ? 'restore track' : 'minimize track'}
    >
      {minimized ? <ArrowRightIcon /> : <ArrowDropDownIcon />}
    </IconButton>
  )
})
