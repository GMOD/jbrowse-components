/* eslint-disable react/require-default-props */
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useState } from 'react'

const useStyles = makeStyles({
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#333',
    whiteSpace: 'nowrap',
  },
})

/**
 * mostly does UI gestures: drag scrolling, etc
 */
function TrackRenderingContainer(props) {
  const { onHorizontalScroll, setScrollTop, trackId, children } = props
  const classes = useStyles()
  const [scheduled, setScheduled] = useState(false)
  const [delta, setDelta] = useState(0)

  return (
    <div
      className={classes.trackRenderingContainer}
      onWheel={({ deltaX }) => {
        if (scheduled) {
          setDelta(delta + deltaX)
        } else {
          // use rAF to make it so multiple event handlers aren't fired per-frame
          // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
          window.requestAnimationFrame(() => {
            onHorizontalScroll(delta + deltaX)
            setScheduled(false)
          })
          setScheduled(true)
          setDelta(0)
        }
      }}
        onScroll={event => {
          setScrollTop(event.target.scrollTop, event.target.clientHeight)
        }}
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
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
  onHorizontalScroll: PropTypes.func.isRequired,
    setScrollTop: PropTypes.func.isRequired,
}

export default observer(TrackRenderingContainer)
