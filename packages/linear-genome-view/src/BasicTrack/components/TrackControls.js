import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React from 'react'
import buttonStyles from '../../LinearGenomeView/components/buttonStyles'

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
  ...buttonStyles(theme),
}))

function TrackControls({ track, view, onConfigureClick, index, ...other }) {
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
    <div {...other}>
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
          style={{ minWidth: 0 }}
          className={classes.toggleButton}
          selected={
            session.visibleDrawerWidget &&
            session.visibleDrawerWidget.id === 'configEditor' &&
            session.visibleDrawerWidget.target.configId ===
              track.configuration.configId
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
            view.setDraggingTrackIdx(index)
          }}
          onDragEnd={() => view.setDraggingTrackIdx(undefined)}
          item
        >
          <Icon className={classes.dragHandle} fontSize="small">
            drag_indicator
          </Icon>
        </Grid>
        <Grid item>
          <Typography
            // component="span"
            variant="body1"
            className={classes.trackName}
          >
            {trackName}
          </Typography>
        </Grid>
      </Grid>
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
  index: ReactPropTypes.number.isRequired,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}

export default observer(TrackControls)
