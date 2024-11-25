import React, { useRef } from 'react'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import Overlay from './Overlay'
import type { BreakpointViewModel } from '../model'

const useStyles = makeStyles()({
  overlay: {
    display: 'flex',
    width: '100%',
    gridArea: '1/1',
    '& path': {
      cursor: 'crosshair',
      fill: 'none',
    },
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
          width: '100%',
          zIndex: 10,
          pointerEvents: interactToggled ? undefined : 'none',
        }}
      >
        {matchedTracks.map(track => (
          // note: we must pass ref down, because:
          // - the child component needs to getBoundingClientRect on the this
          // components SVG, and...
          // - we cannot rely on using getBoundingClientRect in this component
          // to make sure this works because if it gets shifted around by
          // another element, this will not re-render necessarily
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
