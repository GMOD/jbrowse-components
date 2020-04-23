import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import { Menu, MenuOption } from '@gmod/jbrowse-core/ui'
import { getSession } from '@gmod/jbrowse-core/util'
import { getContainingView } from '@gmod/jbrowse-core/util/tracks'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Typography from '@material-ui/core/Typography'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'

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
    verticalAlign: 'middle',
    cursor: 'grab',
    color: '#135560',
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
    const view = getContainingView(track)

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = getSession(view) as any
    let trackName = getConf(track, 'name')
    if (getConf(track, 'type') === 'ReferenceSequenceTrack') {
      trackName = 'Reference Sequence'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      session.assemblies.forEach((assembly: any) => {
        if (assembly.sequence === track.configuration)
          trackName = `Reference Sequence (${readConfObject(assembly, 'name')})`
      })
    }

    function handleMenuItemClick(
      event: React.MouseEvent<HTMLLIElement, MouseEvent>,
      callback: () => void,
    ) {
      callback()
      handleClose()
    }

    const menuItems: MenuOption[] = [
      { label: 'Settings', onClick: onConfigureClick, icon: 'settings' },
    ]

    if (track.menuOptions.length) {
      menuItems.push({ type: 'divider' }, ...track.menuOptions)
    }

    return (
      <>
        <Paper ref={ref} className={clsx(className, classes.root)}>
          <Icon
            draggable
            className={classes.dragHandle}
            fontSize="small"
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            data-testid={`dragHandle-${view.id}-${getConf(track, 'trackId')}`}
          >
            drag_indicator
          </Icon>
          <IconButton
            onClick={() => view.hideTrack(track.configuration)}
            className={classes.iconButton}
            title="close this track"
            color="secondary"
          >
            <Icon fontSize="small">close</Icon>
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
          >
            <Icon fontSize="small">more_vert</Icon>
          </IconButton>
        </Paper>
        <Menu
          anchorEl={anchorEl}
          onMenuItemClick={handleMenuItemClick}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          menuOptions={menuItems}
        />
      </>
    )
  },
)

export default observer(TrackLabel)
