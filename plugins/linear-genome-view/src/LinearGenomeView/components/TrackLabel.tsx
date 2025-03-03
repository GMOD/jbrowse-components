import { forwardRef } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Paper, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackLabelDragHandle from './TrackLabelDragHandle'
import TrackLabelMenu from './TrackLabelMenu'

import type { LinearGenomeViewModel } from '..'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    background: alpha(theme.palette.background.paper, 0.8),
    '&:hover': {
      background: theme.palette.background.paper,
    },
  },
  trackName: {
    fontSize: '0.8rem',
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

const TrackLabel = observer(
  forwardRef<HTMLDivElement, Props>(function TrackLabel2(
    { track, className },
    ref,
  ) {
    const { classes, cx } = useStyles()
    const view = getContainingView(track) as LGV
    const session = getSession(track)
    const trackConf = track.configuration
    const { minimized } = track
    const trackId = getConf(track, 'trackId')
    const trackName = getTrackName(trackConf, session)

    return (
      <Paper
        ref={ref}
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
          onMouseDown={event => {
            // avoid becoming a click-and-drag action on the lgv
            event.stopPropagation()
          }}
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
  }),
)

export default TrackLabel
