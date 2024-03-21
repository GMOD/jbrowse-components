import React, { useRef } from 'react'

import { makeStyles } from 'tss-react/mui'

import Overlay from './Overlay'
import { BreakpointViewModel } from '../model'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  overlay: {
    '& path': {
      cursor: 'crosshair',
      fill: 'none',
    },
    display: 'flex',
    gridArea: '1/1',
    width: '100%',
  },
})

const BreakpointSplitViewOverlay = observer(function ({
  model,
}: {
  model: BreakpointViewModel
}) {
  const { classes } = useStyles()
  const { matchedTracks, interactToggled } = model
  const ref = useRef(null)
  return (
    <div className={classes.overlay}>
      <svg
        ref={ref}
        style={{
          pointerEvents: interactToggled ? undefined : 'none',
          width: '100%',
          zIndex: 10,
        }}
      >
        {matchedTracks.map(track => (
          // note: we must pass ref down, because the child component needs to
          // getBoundingClientRect on the this components SVG, and we cannot
          // rely on using getBoundingClientRect in this component to make
          // sure this works because if it gets shifted around by another
          // element, this will not re-render necessarily
          <Overlay
            parentRef={ref}
            key={track.configuration.trackId}
            model={model}
            trackId={track.configuration.trackId}
          />
        ))}
      </svg>
    </div>
  )
})

export default BreakpointSplitViewOverlay
