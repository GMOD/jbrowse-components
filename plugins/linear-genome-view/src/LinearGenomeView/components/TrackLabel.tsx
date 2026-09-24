import { SanitizedHTML } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  TrackLabelCloseButton,
  TrackLabelMinimizeButton,
} from './TrackLabelButtons.tsx'
import TrackLabelDragHandle from './TrackLabelDragHandle.tsx'
import TrackLabelMenu from './TrackLabelMenu.tsx'
import TrackLabelRefNameWarning from './TrackLabelRefNameWarning.tsx'

import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const useStyles = makeStyles()(theme => ({
  root: {
    // above breakpoint split view
    zIndex: 200,
    background: theme.palette.background.paper,
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: 'calc(100% - 16px)',
  },
  // one line: a long name wrapping over a narrow view covered the data below
  trackName: {
    margin: theme.spacing(0, 0.5),
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
}))

const TrackLabel = observer(function TrackLabel({
  track,
  className,
}: {
  track: BaseTrackModel
  className?: string
}) {
  const { classes } = useStyles()
  const trackName = getTrackName(track.configuration, getSession(track))

  return (
    <Paper
      className={cx(className, classes.root)}
      data-testid={`trackLabel-${track.trackId}`}
    >
      <TrackLabelDragHandle track={track} />
      <TrackLabelCloseButton track={track} />
      <TrackLabelMinimizeButton track={track} />
      <Typography
        variant="body2"
        component="span"
        className={classes.trackName}
      >
        <SanitizedHTML html={trackName} />
      </Typography>
      <TrackLabelRefNameWarning track={track} />
      <TrackLabelMenu track={track} />
    </Paper>
  )
})

export default TrackLabel
