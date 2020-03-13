import { makeStyles } from '@material-ui/core/styles'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useRef, useEffect, useState } from 'react'
import { getParent } from 'mobx-state-tree'

const useStyles = makeStyles(theme => ({
  centerLine: {
    borderLeft: '2px dashed #fff',
    borderRight: '2px dashed #fff',
    color: '#fff',
    backgroundColor: '#fff',
    position: 'absolute',
    zIndex: 20000,
  },
  centerLineContainer: {
    background: theme.palette.grey[600],
    width: '100%',
    height: '100%',
  },
}))

function CenterLine({ model, height }) {
  const { centerLinePosition } = model
  const ref = useRef()
  const classes = useStyles()

  console.log(centerLinePosition)
  return (
    <div
      data-testid="centerline_container"
      className={classes.centerLineContainer}
      role="presentation"
      ref={ref}
      style={{ height }}
    >
      {/* <hr
        width={1}
        height={height}
        style={{
          color: 'black',
          border: 'dashed black',
          transform: 'rotate(90deg)',
          zIndex: 20000,
        }}
      /> */}
      <svg
        role="presentation"
        // className={classes.centerLine}
        ref={ref}
        width={'100%'}
        height={height}
        style={{ zIndex: 20000 }}
      >
        <rect
          className={classes.centerLine}
          x={centerLinePosition}
          y={0}
          width={1}
          height={height}
        />
      </svg>
    </div>
  )
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  height: ReactPropTypes.number.isRequired,
}

CenterLine.defaultProps = {
  children: undefined,
}

export default CenterLine
