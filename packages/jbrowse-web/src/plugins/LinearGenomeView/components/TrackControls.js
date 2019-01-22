import React from 'react'
import { PropTypes, observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import { withStyles } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'

import { getConf } from '../../../configuration'
import ConfigureToggleButton from '../../../components/ConfigureToggleButton'

const styles = (/* theme */) => ({
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
})

function TrackControls({ track, classes, onConfigureClick }) {
  return (
    <>
      <ConfigureToggleButton
        onClick={onConfigureClick}
        title="configure track"
        model={track}
      />
      <Typography variant="body1" className={classes.trackName}>
        {getConf(track, 'name') || track.id}
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
  onConfigureClick: ReactPropTypes.func,
  classes: ReactPropTypes.shape({ trackName: ReactPropTypes.string.isRequired })
    .isRequired,
}
TrackControls.defaultProps = {
  onConfigureClick: undefined,
}

export default withStyles(styles)(observer(TrackControls))
