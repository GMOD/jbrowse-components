import React from 'react'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import {
  AnyConfigurationModel,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { getSession, getContainingView } from '@jbrowse/core/util'
import { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { IconButton, Paper, Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import {
  bindTrigger,
  bindPopover,
  usePopupState,
} from 'material-ui-popup-state/hooks'

// icons
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DragIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'

import { LinearGenomeViewStateModel } from '..'

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
}))

type LGV = Instance<LinearGenomeViewStateModel>

interface Props {
  track: BaseTrackModel
  className?: string
}

function getTrackName(
  track: BaseTrackModel,
  session: { assemblies: AnyConfigurationModel[] },
) {
  const trackName = getConf(track, 'name')
  if (!trackName && getConf(track, 'type') === 'ReferenceSequenceTrack') {
    const asm = session.assemblies.find(a => a.sequence === track.configuration)
    return asm
      ? `Reference Sequence (${
          readConfObject(asm, 'displayName') || readConfObject(asm, 'name')
        })`
      : 'Reference Sequence'
  }
  return trackName
}
const TrackLabel = React.forwardRef<HTMLDivElement, Props>(
  ({ track, className }, ref) => {
    const { classes, cx } = useStyles()
    const view = getContainingView(track) as LGV
    const session = getSession(track)
    const trackConf = track.configuration
    const trackId = getConf(track, 'trackId')
    const trackName = getTrackName(track, session)

    const popupState = usePopupState({
      popupId: 'trackLabelMenu',
      variant: 'popover',
    })

    const onDragStart = (event: React.DragEvent<HTMLSpanElement>) => {
      const target = event.currentTarget
      if (target.parentNode) {
        const parent = target.parentNode as HTMLElement
        event.dataTransfer.setDragImage(parent, 20, 20)
        view.setDraggingTrackId(track.id)
      }
    }

    const items = [
      ...(session.getTrackActionMenuItems?.(trackConf) || []),
      ...track.trackMenuItems(),
    ].sort((a, b) => (b.priority || 0) - (a.priority || 0))

    return (
      <Paper ref={ref} className={cx(className, classes.root)}>
        <span
          draggable
          className={classes.dragHandle}
          onDragStart={onDragStart}
          onDragEnd={() => view.setDraggingTrackId(undefined)}
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
          {...bindTrigger(popupState)}
          className={classes.iconButton}
          color="secondary"
          data-testid="track_menu_icon"
          disabled={!items.length}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <CascadingMenu
          {...bindPopover(popupState)}
          onMenuItemClick={(_: unknown, callback: Function) => callback()}
          menuItems={items}
          popupState={popupState}
        />
      </Paper>
    )
  },
)

export default observer(TrackLabel)
