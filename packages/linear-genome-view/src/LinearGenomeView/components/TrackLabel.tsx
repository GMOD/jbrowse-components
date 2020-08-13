import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import { Menu, MenuItem } from '@gmod/jbrowse-core/ui'
import { getSession, getContainingView } from '@gmod/jbrowse-core/util'
import IconButton from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Typography from '@material-ui/core/Typography'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import DragIcon from '@material-ui/icons/DragIndicator'
import CloseIcon from '@material-ui/icons/Close'
import SettingsIcon from '@material-ui/icons/Settings'

import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'
import { LinearGenomeViewStateModel } from '..'

const useStyles = makeStyles(theme => ({
  root: {
    background: fade(theme.palette.background.paper, 0.8),
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

const TrackLabel = React.forwardRef(
  (
    props: {
      track: Instance<BaseTrackStateModel>
      className?: string
    },
    ref,
  ) => {
    const classes = useStyles()
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
    const { track, className } = props
    const view = (getContainingView(track) as unknown) as Instance<
      LinearGenomeViewStateModel
    >

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
      setAnchorEl(null)
    }

    const onConfigureClick = () => {
      track.activateConfigurationUI()
      handleClose()
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

    const session = getSession(view)
    let trackName = getConf(track, 'name')
    if (getConf(track, 'type') === 'ReferenceSequenceTrack') {
      trackName = 'Reference Sequence'
      session.assemblies.forEach(assembly => {
        if (assembly.sequence === track.configuration)
          trackName = `Reference Sequence (${readConfObject(assembly, 'name')})`
      })
    }

    function handleMenuItemClick(
      event: React.MouseEvent<HTMLLIElement, MouseEvent>,
      callback: Function,
    ) {
      callback()
      handleClose()
    }

    const menuItems: MenuItem[] = track.canConfigure
      ? [{ label: 'Settings', onClick: onConfigureClick, icon: SettingsIcon }]
      : []

    if (track.menuItems.length) {
      if (menuItems.length) {
        menuItems.push({ type: 'divider' })
      }
      menuItems.push(...track.menuItems)
    }

    return (
      <>
        <Paper ref={ref} className={clsx(className, classes.root)}>
          <span
            draggable
            className={classes.dragHandle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            data-testid={`dragHandle-${view.id}-${getConf(track, 'trackId')}`}
          >
            <DragIcon fontSize="small" className={classes.dragHandleIcon} />
          </span>
          <IconButton
            onClick={() => view.hideTrack(track.configuration)}
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
            disabled={!menuItems.length}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Paper>
        <Menu
          anchorEl={anchorEl}
          onMenuItemClick={handleMenuItemClick}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          menuItems={menuItems}
        />
      </>
    )
  },
)

export default observer(TrackLabel)
