import { makeStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles(theme => ({
  elidedBlock: {
    minHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
  interRegionPaddingBlock: {
    minHeight: '100%',
    backgroundColor: theme.palette.text.primary,
  },
  boundaryPaddingBlock: {
    minHeight: '100%',
    backgroundColor: theme.palette.action.disabledBackground,
  },
}))

export const ElidedBlockMarker = ({ width }) => {
  const classes = useStyles()
  return <div className={classes.elidedBlock} style={{ width: `${width}px` }} />
}
ElidedBlockMarker.propTypes = {
  width: ReactPropTypes.number.isRequired,
}

export const InterRegionPaddingBlockMarker = ({ boundary, width, style }) => {
  const classes = useStyles()
  return (
    <div
      style={{
        ...style,
        width: `${width}px`,
      }}
      className={
        boundary
          ? classes.boundaryPaddingBlock
          : classes.interRegionPaddingBlock
      }
    />
  )
}
InterRegionPaddingBlockMarker.propTypes = {
  boundary: ReactPropTypes.bool,
  width: ReactPropTypes.number.isRequired,
  style: ReactPropTypes.shape(),
}

InterRegionPaddingBlockMarker.defaultProps = {
  boundary: false,
  style: {},
}
