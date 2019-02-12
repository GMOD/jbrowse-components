import React from 'react'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core'

const styles = {
  trackRenderingContainer: {
    overflow: 'hidden',
    background: '#333',
    whiteSpace: 'nowrap',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */
function TrackRenderingContainer(props) {
  const { trackId, width, children, classes } = props
  return (
    <div
      className={classes.trackRenderingContainer}
      style={{
        gridRow: `track-${trackId}`,
        gridColumn: 'blocks',
        width: `${width}px`,
      }}
      role="presentation"
    >
      {children}
    </div>
  )
}
TrackRenderingContainer.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  trackId: PropTypes.string.isRequired,
  width: PropTypes.number.isRequired,
  children: PropTypes.node,
}

TrackRenderingContainer.defaultProps = {
  children: undefined,
}

export default withStyles(styles)(observer(TrackRenderingContainer))
