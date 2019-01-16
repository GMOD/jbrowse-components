import React from 'react'
import { PropTypes, observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { IconButton, Icon, withStyles } from '@material-ui/core'
import { getConf } from '../../../configuration'

const styles = theme => ({
  trackName: {
    margin: '0 auto',
    width: '90%',
    fontSize: '80%',
  },
  trackDescription: {
    fontSize: '60%',
    margin: '0.25em auto',
    width: '90%',
    color: '#5a5a5a',
  },
})

function TrackControls({ track, classes, onConfigureClick }) {
  return (
    <>
      <IconButton
        type="button"
        onClick={onConfigureClick}
        size="small"
        style={{ padding: '4px' }}
        title="configure this track"
      >
        <Icon style={{ fontSize: '12px' }}>settings</Icon>
      </IconButton>
      <div className={classes.trackName}>
        {getConf(track, 'name') || track.id}
      </div>
      <div className={classes.trackDescription}>
        {getConf(track, 'description')}
      </div>
    </>
  )
}

TrackControls.propTypes = {
  track: PropTypes.objectOrObservableObject.isRequired,
  onConfigureClick: ReactPropTypes.func,
  classes: ReactPropTypes.shape({ trackName: ReactPropTypes.string.isRequired })
    .isRequired,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}

export default withStyles(styles)(observer(TrackControls))
