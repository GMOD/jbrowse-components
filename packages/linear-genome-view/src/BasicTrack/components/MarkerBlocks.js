import { makeStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles({
  elidedBlock: {
    position: 'absolute',
    minHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
  interRegionPaddingBlock: {
    position: 'absolute',
    minHeight: '100%',
    backgroundColor: '#333',
  },
})

export const ElidedBlockMarker = ({ width, offset }) => {
  const classes = useStyles()
  return (
    <div
      className={classes.elidedBlock}
      style={{ left: `${offset}px`, width: `${width}px` }}
    />
  )
}
ElidedBlockMarker.propTypes = {
  width: ReactPropTypes.number.isRequired,
  offset: ReactPropTypes.number.isRequired,
}

export const InterRegionPaddingBlockMarker = ({ model, block }) => {
  const classes = useStyles()
  return (
    <div
      style={{
        left: `${block.offsetPx - model.offsetPx}px`,
        width: `${block.widthPx}px`,
      }}
      className={classes.interRegionPaddingBlock}
    ></div>
  )
}
InterRegionPaddingBlockMarker.propTypes = {
  model: ReactPropTypes.shape().isRequired,
  block: ReactPropTypes.shape().isRequired,
}
