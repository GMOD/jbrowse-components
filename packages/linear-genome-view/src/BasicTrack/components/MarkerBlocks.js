import { makeStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import React from 'react'

const useStyles = makeStyles({
  elidedBlock: {
    minHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
  interRegionPaddingBlock: {
    minHeight: '100%',
    backgroundColor: '#333',
  },
})

export const ElidedBlockMarker = ({ width }) => {
  const classes = useStyles()
  return <div className={classes.elidedBlock} style={{ width: `${width}px` }} />
}
ElidedBlockMarker.propTypes = {
  width: ReactPropTypes.number.isRequired,
}

export const InterRegionPaddingBlockMarker = ({ width }) => {
  const classes = useStyles()
  return (
    <div
      style={{
        width: `${width}px`,
      }}
      className={classes.interRegionPaddingBlock}
    ></div>
  )
}
InterRegionPaddingBlockMarker.propTypes = {
  width: ReactPropTypes.number.isRequired,
}
