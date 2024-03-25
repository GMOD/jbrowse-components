import React from 'react'
import { IconButton, Paper, Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { getSession, getContainingView } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { SanitizedHTML } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'

import { LinearGenomeViewModel } from '..'
import TrackLabelDragHandle from './TrackLabelDragHandle'

const useStyles = makeStyles()(theme => ({
  root: {
    background: alpha(theme.palette.background.paper, 0.8),
    '&:hover': {
      background: theme.palette.background.paper,
    },
    transition: theme.transitions.create(['background'], {
      duration: theme.transitions.duration.shortest,
    }),
  },
  trackName: {
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

const TrackLabel = observer(
  React.forwardRef<HTMLDivElement, Props>(function TrackLabel2(
    { track, className },
    ref,
  ) {
    const { classes, cx } = useStyles()
    const view = getContainingView(track) as LGV
    const session = getSession(track)
    const trackConf = track.configuration
    const minimized = track.minimized
    const trackId = getConf(track, 'trackId')
    const trackName = getTrackName(trackConf, session)
    const items = [
      {
        label: minimized ? 'Restore track' : 'Minimize track',
        icon: minimized ? AddIcon : MinimizeIcon,
        onClick: () => track.setMinimized(!minimized),
      },
      ...(session.getTrackActionMenuItems?.(trackConf) || []),
      ...track.trackMenuItems(),
    ].sort((a, b) => (b?.priority || 0) - (a?.priority || 0))

    return (
      <Paper ref={ref} className={cx(className, classes.root)}>
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

        <CascadingMenuButton menuItems={items} data-testid="track_menu_icon">
          <MoreVertIcon fontSize="small" />
        </CascadingMenuButton>
      </Paper>
    )
  }),
)

export default TrackLabel
