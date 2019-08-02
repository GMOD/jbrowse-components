import React, { useRef } from 'react'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core'

const styles = {
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#333',
    whiteSpace: 'nowrap',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */
function TrackRenderingContainer({
  trackId,
  children,
  classes,
  scrollTop = 0,
}) {
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
  scrollTop: PropTypes.number,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
}

export default withStyles(styles)(observer(TrackRenderingContainer))
