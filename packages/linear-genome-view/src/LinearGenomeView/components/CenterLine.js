import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useRef } from 'react'

const useStyles = makeStyles(() => ({
  centerLineContainer: {
    background: 'transparent',
    height: '100%',
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
    whiteSpace: 'nowrap',
  },
}))

function CenterLine({ model }) {
  const { bpPerPx, headerHeight, viewingRegionWidth, controlsWidth } = model
  const ref = useRef()
  const classes = useStyles()
  const startingPosition = viewingRegionWidth / 2 + controlsWidth

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
        // text that indicates what bp is center, positioned
        // at the bottom right of the center line
        data-testid="centerline_text"
        className={classes.centerLineText}
        role="presentation"
        style={{
          left: Math.max(1 / bpPerPx, 1) + 5,
          bottom: headerHeight,
        }}
      >
        Bp: {model.centerLinePosition.offset}
      </div>
    </div>
  )
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(CenterLine)
