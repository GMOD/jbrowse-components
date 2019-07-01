import React from 'react'
import { PropTypes, observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'

import { withStyles, IconButton, Icon } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'

import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'
import ConfigureToggleButton from '@gmod/jbrowse-core/components/ConfigureToggleButton'

import buttonStyles from '../../LinearGenomeView/components/buttonStyles'

const styles = theme => ({
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
})

function TrackControls({ track, view, classes, onConfigureClick }) {
  let trackName = getConf(track, 'name') || track.id
  if (getConf(track, 'type') === 'ReferenceSequenceTrack') {
    trackName = 'Refence Sequence'
    const rootModel = getRoot(view)
    rootModel.configuration.assemblies.forEach(assembly => {
      if (assembly.sequence === track.configuration)
        trackName = `Reference Sequence (${readConfObject(
          assembly,
          'assemblyName',
        )})`
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
        <ConfigureToggleButton
          onClick={onConfigureClick}
          title="configure track"
          model={track}
        />
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
  classes: ReactPropTypes.shape({ trackName: ReactPropTypes.string.isRequired })
    .isRequired,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}

export default withStyles(styles)(observer(TrackControls))
