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

function TrackControls({ track, view, onConfigureClick, index }) {
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
    <>
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
      <div
        draggable
        onDragStart={() => {
          view.setDraggingTrackIdx(index)
        }}
        onDragEnd={() => {
          if (
            view.targetDraggingTrackIdx &&
            view.draggingTrackIdx !== view.targetDraggingTrackIdx &&
            view.draggingTrackIdx + 1 !== view.targetDraggingTrackIdx
          ) {
            if (view.draggingTrackIdx < view.targetDraggingTrackIdx)
              view.moveTrack(
                view.draggingTrackIdx,
                view.targetDraggingTrackIdx - 1,
              )
            else
              view.moveTrack(view.draggingTrackIdx, view.targetDraggingTrackIdx)
          }
          view.setDraggingTrackIdx(undefined)
          view.setTargetDraggingTrackIdx(undefined)
        }}
      >
        <Grid container wrap="nowrap" alignItems="center">
          <Grid item>
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
      </div>
      <Typography
        variant="body2"
        color="textSecondary"
        className={classes.trackDescription}
      >
        {getConf(track, 'description')}
      </Typography>
    </>
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
