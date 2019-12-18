import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import { getConf, readConfObject } from '../configuration'
import { getSession } from '../util'

const useStyles = makeStyles(theme => ({
  trackName: {
    margin: '0 auto',
    width: '90%',
    fontSize: '0.8rem',
  },
  trackDescription: {
    margin: '0 auto',
    width: '90%',
    fontSize: '0.7rem',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#135560',
  },
  iconButton: {
    padding: theme.spacing(0.5),
  },
  toggleButton: {
    height: theme.spacing(4),
    minWidth: 0,
    border: 'none',
  },
}))

function TrackControls({
  track,
  view,
  onConfigureClick,
  children = null,
  ...other
}) {
  const classes = useStyles()
  let trackName = getConf(track, 'name') || track.id
  const session = getSession(track)
  if (getConf(track, 'type') === 'ReferenceSequenceTrack') {
    trackName = 'Reference Sequence'
    session.datasets.forEach(datasetConf => {
      const { assembly } = datasetConf
      if (assembly.sequence === track.configuration)
        trackName = `Reference Sequence (${readConfObject(assembly, 'name')})`
    })
  }
  return (
    <div
      data-testid={`trackControls-${view.id}-${getConf(track, 'trackId')}`}
      {...other}
    >
      <IconButton
        onClick={() => view.hideTrack(track.configuration)}
        className={classes.iconButton}
        title="close this track"
        color="secondary"
      >
        <Icon fontSize="small">close</Icon>
      </IconButton>
      {track.showConfigurationButton ? (
        <ToggleButton
          type="button"
          title="configure track"
          size="small"
          className={classes.toggleButton}
          selected={
            session.visibleDrawerWidget &&
            session.visibleDrawerWidget.id === 'configEditor' &&
            session.visibleDrawerWidget.target &&
            session.visibleDrawerWidget.target.trackId &&
            session.visibleDrawerWidget.target.trackId ===
              track.configuration.trackId
          }
          value="configure"
          onClick={onConfigureClick}
        >
          <Icon fontSize="small" style={{ color: '#135560' }}>
            settings
          </Icon>
        </ToggleButton>
      ) : null}
      <Grid container wrap="nowrap" alignItems="center">
        <Grid
          draggable
          onDragStart={event => {
            event.dataTransfer.setDragImage(event.target.parentNode, 20, 20)
            view.setDraggingTrackId(track.id)
          }}
          onDragEnd={() => view.setDraggingTrackId(undefined)}
          item
          data-testid={`dragHandle-${view.id}-${getConf(track, 'trackId')}`}
        >
          <Icon className={classes.dragHandle} fontSize="small">
            drag_indicator
          </Icon>
        </Grid>
        <Grid item>
          <Typography variant="body1" className={classes.trackName}>
            {trackName}
          </Typography>
        </Grid>
      </Grid>
      {children}
      <Typography
        variant="body2"
        color="textSecondary"
        className={classes.trackDescription}
      >
        {getConf(track, 'description')}
      </Typography>
    </div>
  )
}

TrackControls.propTypes = {
  track: PropTypes.objectOrObservableObject.isRequired,
  view: PropTypes.objectOrObservableObject.isRequired,
  onConfigureClick: ReactPropTypes.func,
  children: ReactPropTypes.node,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
  children: null,
}

export default observer(TrackControls)
