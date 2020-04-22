/* eslint-disable react/require-default-props */
import { makeStyles } from '@material-ui/core/styles'
import Paper from '@material-ui/core/Paper'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { ReactNode } from 'react'

const useStyles = makeStyles({
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
    position: 'relative',
    background: 'none',
    zIndex: 2,
    boxSizing: 'content-box',
  },
  // -1 offset because of the 1px border of the Paper
  trackOffsetContainer: {
    position: 'absolute',
    left: -1,
    height: '100%',
  },
})

const TrackRenderingContainer: React.FC<{
  onHorizontalScroll: Function
  setScrollTop: Function
  children?: ReactNode
  trackId: string
  trackHeight: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [x: string]: any
}> = props => {
  const {
    onHorizontalScroll,
    setScrollTop,
    trackId,
    trackHeight,
    children,
    ...other
  } = props
  const classes = useStyles()

  return (
    <Paper
      variant="outlined"
      className={classes.trackRenderingContainer}
      style={{ height: trackHeight }}
      onScroll={event => {
        const target = event.target as HTMLDivElement
        setScrollTop(target.scrollTop, target.clientHeight)
      }}
      role="presentation"
      {...other}
    >
      <div className={classes.trackOffsetContainer}>{children}</div>
    </Paper>
  )
}

TrackRenderingContainer.propTypes = {
  trackId: PropTypes.string.isRequired,
  children: PropTypes.node,
  setScrollTop: PropTypes.func.isRequired,
  onHorizontalScroll: PropTypes.func.isRequired,
  trackHeight: PropTypes.number.isRequired,
}

export default observer(TrackRenderingContainer)
