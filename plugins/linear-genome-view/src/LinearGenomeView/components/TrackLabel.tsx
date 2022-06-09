import React from 'react'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { Menu } from '@jbrowse/core/ui'
import { getSession, getContainingView } from '@jbrowse/core/util'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { IconButton, Paper, Typography, Theme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui';

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DragIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'

import { LinearGenomeViewStateModel } from '..'

const useStyles = makeStyles()((theme: Theme) => ({
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
    margin: '0 auto',
    width: '90%',
    fontSize: '0.8rem',
    pointerEvents: 'none',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#135560',
  },
  dragHandleIcon: {
    display: 'inline-block',
    verticalAlign: 'middle',
    pointerEvents: 'none',
  },
  iconButton: {
    padding: theme.spacing(1),
  },
}));

type LGV = Instance<LinearGenomeViewStateModel>

const TrackLabel = React.forwardRef(
  (props: { track: BaseTrackModel; className?: string }, ref) => {
    const { classes, cx } = useStyles()
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
    const { track, className } = props
    const view = getContainingView(track) as LGV
    const session = getSession(track)
    const trackConf = track.configuration
    const trackId = getConf(track, 'trackId')

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
      setAnchorEl(null)
    }

    const onDragStart = (event: React.DragEvent<HTMLSpanElement>) => {
      const target = event.target as HTMLElement
      if (target.parentNode) {
        event.dataTransfer.setDragImage(
          target.parentNode as HTMLElement,
          20,
          20,
        )
        view.setDraggingTrackId(track.id)
      }
    }

    const onDragEnd = () => {
      view.setDraggingTrackId(undefined)
    }

    let trackName = getConf(track, 'name')
    if (getConf(track, 'type') === 'ReferenceSequenceTrack') {
      const r = session.assemblies.find(a => a.sequence === trackConf)
      trackName =
        readConfObject(trackConf, 'name') ||
        (r
          ? `Reference Sequence (${readConfObject(r, 'name')})`
          : 'Reference Sequence')
    }

    function handleMenuItemClick(_: unknown, callback: Function) {
      callback()
      handleClose()
    }

    const items = [
      ...(session.getTrackActionMenuItems?.(trackConf) || []),
      ...track.trackMenuItems(),
    ].sort((a, b) => (b.priority || 0) - (a.priority || 0))

    return (
      // @ts-ignore
      <Paper ref={ref} className={cx(className, classes.root)}>
        <span
          draggable
          className={classes.dragHandle}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          data-testid={`dragHandle-${view.id}-${trackId}`}
        >
          <DragIcon className={classes.dragHandleIcon} fontSize="small" />
        </span>
        <IconButton
          onClick={() => view.hideTrack(trackId)}
          className={classes.iconButton}
          title="close this track"
          color="secondary"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Typography
          variant="body1"
          component="span"
          className={classes.trackName}
        >
          {trackName}
        </Typography>
        <IconButton
          aria-controls="simple-menu"
          aria-haspopup="true"
          onClick={handleClick}
          className={classes.iconButton}
          color="secondary"
          data-testid="track_menu_icon"
          disabled={!items.length}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          onMenuItemClick={handleMenuItemClick}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          menuItems={items}
        />
      </Paper>
    );
  },
)

export default observer(TrackLabel)
