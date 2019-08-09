import { getSession } from '@gmod/jbrowse-core/util'
import React from 'react'
import { PropTypes, observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { makeStyles, IconButton, Icon, Typography } from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton'

import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'

import buttonStyles from '../../LinearGenomeView/components/buttonStyles'

const useStyles = makeStyles(theme => ({
  trackName: {
    margin: '0 auto',
    width: '90%',
    fontSize: '80%',
  },

  trackDescription: {
    margin: '0.25em auto',
    width: '90%',
    fontSize: '70%',
    // color: '#5a5a5a',
  },

  ...buttonStyles(theme),
}))

function TrackControls({ track, view, onConfigureClick }) {
  const classes = useStyles()
  let trackName = getConf(track, 'name') || track.id
  const session = getSession(track)
  if (getConf(track, 'type') === 'ReferenceSequenceTrack') {
    trackName = 'Reference Sequence'
    session.datasets.forEach(datsetConf => {
      const { assembly } = datsetConf
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
          <Icon fontSize="small">settings</Icon>
        </ToggleButton>
      ) : null}
      <Typography variant="body1" className={classes.trackName}>
        {trackName}
      </Typography>
      <Typography
        variant="caption"
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
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}

export default observer(TrackControls)
