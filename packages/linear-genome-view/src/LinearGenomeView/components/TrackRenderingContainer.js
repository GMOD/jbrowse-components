import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core'

const styles = {
  trackRenderingContainer: {
    overflowY: 'auto',
    background: '#333',
    whiteSpace: 'nowrap',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */
function TrackRenderingContainer(props) {
  const { trackId, heightA, children, classes, scrollTop } = props
  const nameRef = useRef()

  if (nameRef.current) {
    nameRef.current.scrollTop = scrollTop
  }
  return (
    <div
      className={classes.trackRenderingContainer}
      ref={nameRef}
      style={{
        gridRow: `track-${trackId}`,
        gridColumn: 'blocks',
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
  children: PropTypes.node,
}

TrackRenderingContainer.defaultProps = {
  children: undefined,
}

export default withStyles(styles)(observer(TrackRenderingContainer))
