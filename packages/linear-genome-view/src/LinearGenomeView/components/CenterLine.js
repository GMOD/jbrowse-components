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
    fontWeight: 'bold',
  },
  sortText: {
    color: 'green',
    fontWeight: 'bold',
  },
}))

function CenterLine({ model }) {
  const { bpPerPx, trackHeights, width, tracks } = model
  const ref = useRef()
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
      <div
        // text that indicates what bp is center, positioned
        // at the bottom right of the center line
        data-testid="centerline_text"
        className={classes.centerLineText}
        role="presentation"
        style={{
          left: Math.max(1 / bpPerPx, 1) + 5,
          top: !tracks[0].sortedBy ? trackHeights : trackHeights - 15,
        }}
      >
        Bp: {Math.round(model.centerLinePosition.offset) + 1}
        {tracks[0].sortedBy ? (
          <div className={classes.sortText}>
            Sort: {tracks[0].PileupTrack.sortObject.by.toUpperCase()} at{' '}
            {tracks[0].PileupTrack.sortObject.position}
          </div>
        ) : null}
      </div>
    </div>
  ) : null
}

CenterLine.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(CenterLine)
