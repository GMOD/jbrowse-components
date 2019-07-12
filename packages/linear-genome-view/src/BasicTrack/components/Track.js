import { withStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'

const styles = {
  track: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: '#555',
    minHeight: '100%',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */

const Track = ({ classes, children, trackId }) => (
  <div
    data-testid={`track-${trackId}`}
    className={classes.track}
    role="presentation"
  >
    {children}
  </div>
)
Track.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
}

Track.defaultProps = { children: null }

export default withStyles(styles)(observer(Track))
