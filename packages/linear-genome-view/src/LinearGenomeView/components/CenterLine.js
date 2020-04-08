import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useRef } from 'react'

const useStyles = makeStyles(() => ({
  centerLineContainer: {
    background: 'transparent',
    height: '100%',
    zIndex: 10, // above the track but under menu
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
  const { bpPerPx, trackHeights, width } = model
  const ref = useRef()
  const classes = useStyles()
  const startingPosition = width / 2

  return (
    <div
      data-testid="centerline_container"
      className={classes.centerLineContainer}
      role="presentation"
      ref={ref}
      style={{
        left: `${startingPosition}px`,
        width: Math.max(1 / bpPerPx, 1),
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
          top: trackHeights,
        }}
      >
        Bp: {Math.round(model.centerLinePosition.offset) + 1}
      </div>
    </div>
  )
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(CenterLine)
