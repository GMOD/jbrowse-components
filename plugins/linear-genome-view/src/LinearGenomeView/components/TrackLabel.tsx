import { SanitizedHTML } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Paper, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import TrackLabelDragHandle from './TrackLabelDragHandle.tsx'
import TrackLabelMenu from './TrackLabelMenu.tsx'

import type { LinearGenomeViewModel } from '..'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    // above breakpoint split view
    zIndex: 200,
    background: alpha(theme.palette.background.paper, 0.8),
    '&:hover': {
      background: theme.palette.background.paper,
    },
  },
  trackName: {
    margin: '0 auto',
    width: '90%',
    fontSize: '0.8rem',
    pointerEvents: 'none',
  },
  iconButton: {
    padding: theme.spacing(1),
  },
}))

type LGV = LinearGenomeViewModel

interface Props {
  track: BaseTrackModel
  className?: string
}

const TrackLabel = observer(function TrackLabel({ track, className }: Props) {
  const { classes } = useStyles()
  const view = getContainingView(track) as LGV
  const session = getSession(track)
  const { minimized } = track
  const trackId = track.trackId
  const trackName = getTrackName(track.configuration, session)

  return (
    <Paper
      className={cx(className, classes.root)}
      onClick={event => {
        // avoid clicks on track label from turning into double-click zoom
        event.stopPropagation()
      }}
    >
      <TrackLabelDragHandle track={track} trackId={trackId} view={view} />
      <IconButton
        onClick={() => view.hideTrack(trackId)}
        className={classes.iconButton}
        title="close this track"
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <Typography
        variant="body1"
        component="span"
        className={classes.trackName}
      >
        <SanitizedHTML
          html={[trackName, minimized ? '(minimized)' : '']
            .filter(f => !!f)
            .join(' ')}
        />
      </Typography>
      <TrackLabelMenu track={track} />
    </Paper>
  )
})

export default TrackLabel
