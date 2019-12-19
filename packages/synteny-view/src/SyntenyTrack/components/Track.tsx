/* eslint-disable react/require-default-props */
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { ReactNode } from 'react'

const useStyles = makeStyles(theme => ({
  track: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: theme.palette.grey[600],
    minHeight: '100%',
  },
}))

/**
 * mostly does UI gestures: drag scrolling, etc
 */

const Track: React.FC<{
  onHorizontalScroll: Function
  trackId: string
  children?: ReactNode
}> = ({ children, onHorizontalScroll, trackId }) => {
  const classes = useStyles()
  return (
    <div
      data-testid={`track-${trackId}`}
      className={classes.track}
      role="presentation"
    >
      {children}
    </div>
  )
}

Track.propTypes = {
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
  onHorizontalScroll: PropTypes.func.isRequired,
}

export default observer(Track)
