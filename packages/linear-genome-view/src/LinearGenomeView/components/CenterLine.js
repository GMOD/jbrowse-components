import { makeStyles } from '@material-ui/core/styles'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useRef } from 'react'
import { getParent } from 'mobx-state-tree'

const useStyles = makeStyles(() => ({
  centerLineContainer: {
    background: 'transparent',
    height: '100%',
    width: 1,
    zIndex: 1,
    position: 'absolute',
  },
}))

// TODO: width must be dependent on zoom level, create a second container
// and line if zoomed in enough where bp length is larger than 1 px
// from | to | | to encapsulate the whole bp it is showing. try to make it dotted
function CenterLine({ model, height, startingPosition }) {
  const { centerLinePosition } = model
  const ref = useRef()
  const svgRef = useRef()
  const classes = useStyles()
  const { bpPerPx } = getParent(getParent(model))

  function drawCenterLine(offsetPx) {
    return (
      <div
        data-testid="centerline_container"
        className={classes.centerLineContainer}
        role="presentation"
        ref={ref}
        value={centerLinePosition}
        style={{ left: `${startingPosition + offsetPx}px` }}
      >
        <svg role="presentation" ref={svgRef} width={'100%'} height={height}>
          <rect
            x={0}
            y={0}
            width="100%"
            height={height - 10}
            fill="black"
            strokeWidth={3}
            strokeDasharray="1, 6"
          />
        </svg>
        {offsetPx === 0 && `center base at: ${centerLinePosition}`}
      </div>
    )
  }

  // less than 0.05 need to make it
  return (
    <>
      {drawCenterLine(0)}
      {bpPerPx <= 0.05 ? drawCenterLine(1 / bpPerPx) : null}
    </>
  )
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
  height: ReactPropTypes.number.isRequired,
  startingPosition: ReactPropTypes.number.isRequired,
}

CenterLine.defaultProps = {
  children: undefined,
}

export default CenterLine
