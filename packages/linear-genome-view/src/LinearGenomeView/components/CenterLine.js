import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useRef } from 'react'

const useStyles = makeStyles(() => ({
  centerLineContainer: {
    background: 'transparent',
    height: '90%',
    zIndex: 1,
    position: 'absolute',
    border: '1px black dashed',
    borderTop: 'none',
    borderBottom: 'none',
    pointerEvents: 'none',
  },
  centerLineText: {
    position: 'absolute',
    pointerEvents: 'none',
    // overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
}))

function CenterLine({ model }) {
  // view level center line
  const { bpPerPx, headerHeight, dynamicBlocks, controlsWidth, height } = model
  const ref = useRef()
  const classes = useStyles()
  const startingPosition = dynamicBlocks.totalWidthPx / 2 + controlsWidth

  return (
    <div
      data-testid="centerline_container"
      className={classes.centerLineContainer}
      role="presentation"
      ref={ref}
      style={{
        left: `${startingPosition}px`,
        width: Math.max(1 / bpPerPx, 1),
        top: headerHeight,
      }}
    >
      <div
        data-testid="centerline_text"
        className={classes.centerLineText}
        role="presentation"
        style={{
          left: Math.max(1 / bpPerPx, 1) + 5,
          top: height * 0.8,
        }}
      >
        Bp: {model.centerLinePosition}
      </div>
    </div>
  )
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

CenterLine.defaultProps = {
  children: undefined,
  heightOffset: 0,
}

export default observer(CenterLine)
