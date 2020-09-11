import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useRef } from 'react'
import { Instance } from 'mobx-state-tree'
import { LinearGenomeViewStateModel } from '..'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(() => ({
  centerLineContainer: {
    background: 'transparent',
    height: '100%',
    zIndex: 5, // above the track but under menu
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
    fontWeight: 'bold',
  },
}))

function CenterLine({ model }: { model: LGV }) {
  const { bpPerPx, centerLineInfo, trackHeights, tracks, width } = model
  const ref = useRef<HTMLDivElement>(null)
  const classes = useStyles()
  const startingPosition = width / 2

  return tracks.length ? (
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
      {centerLineInfo && (
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
          {/* change bp to refName */}
          {centerLineInfo.refName}:{' '}
          {Math.max(Math.round(centerLineInfo.offset) + 1, 0)}
        </div>
      )}
    </div>
  ) : null
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(CenterLine)
