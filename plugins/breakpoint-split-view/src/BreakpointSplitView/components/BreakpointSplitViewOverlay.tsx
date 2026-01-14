import { useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Overlay from './Overlay.tsx'

import type { BreakpointViewModel } from '../model.ts'

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
  base: {
    // we set pointerEvents:none here but individual overlays can add
    // pointerEvents:'auto' to retoggle it back on for a single e.g. svg line
    pointerEvents: 'none',
    width: '100%',
    zIndex: 100,
  },
})

const BreakpointSplitViewOverlay = observer(
  function BreakpointSplitViewOverlay({
    model,
  }: {
    model: BreakpointViewModel
  }) {
    const { classes } = useStyles()
    const { matchedTracks } = model
    const ref = useRef(null)
    return (
      <div className={classes.overlay}>
        <svg ref={ref} className={classes.base}>
          {matchedTracks.map(track => (
            // note: we must pass ref down, because:
            //
            // 1. the child component needs to getBoundingClientRect on the this
            // components SVG, and...
            //
            // 2. we cannot rely on using getBoundingClientRect in this component
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
  },
)

export default BreakpointSplitViewOverlay
