import { forwardRef, useEffect, useRef, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Paper, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import TrackLabelDragHandle from './TrackLabelDragHandle'
import TrackLabelMenu from './TrackLabelMenu'

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
  focusHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: alpha(theme.palette.secondary.light, 0.4),
    pointerEvents: 'none',
    animation: 'focusFadeOut 3s ease-out forwards',
    '@keyframes focusFadeOut': {
      '0%': {
        opacity: 1,
      },
      '100%': {
        opacity: 0,
      },
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
  isFocused?: boolean
}

const TrackLabel = observer(
  forwardRef<HTMLDivElement, Props>(function TrackLabel2(
    { track, className, isFocused },
    ref,
  ) {
    const { classes } = useStyles()
    const view = getContainingView(track) as LGV
    const session = getSession(track)
    const { minimized } = track
    const trackId = getConf(track, 'trackId')
    const trackName = getTrackName(track.configuration, session)
    const prevFocused = useRef(isFocused)
    const [animationKey, setAnimationKey] = useState(0)

    useEffect(() => {
      if (isFocused && !prevFocused.current) {
        setAnimationKey(k => k + 1)
      }
      prevFocused.current = isFocused
    }, [isFocused])

    return (
      <Paper
        ref={ref}
        className={cx(className, classes.root)}
        style={{ position: 'relative' }}
        onClick={event => {
          // avoid clicks on track label from turning into double-click zoom
          event.stopPropagation()
        }}
      >
        {isFocused ? (
          <div key={animationKey} className={classes.focusHighlight} />
        ) : null}
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
  }),
)

export default TrackLabel
