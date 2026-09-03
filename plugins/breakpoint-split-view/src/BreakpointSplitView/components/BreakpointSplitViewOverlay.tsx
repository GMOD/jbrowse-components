import { useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Overlay from './Overlay.tsx'
import { useOverlayWheelZoom } from './useOverlayWheelZoom.ts'

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
    // pointerEvents:none lets clicks pass through to the views below.
    // Individual overlay paths can opt back in via pointerEvents:'auto'.
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
    const { matchedTracks, views } = model
    const divRef = useRef<HTMLDivElement>(null)
    useOverlayWheelZoom(divRef, views)

    return (
      <div ref={divRef} className={classes.overlay}>
        <svg className={classes.base}>
          {matchedTracks.map(track => {
            const trackId = track.configuration.trackId
            return <Overlay key={trackId} model={model} trackId={trackId} />
          })}
        </svg>
      </div>
    )
  },
)

export default BreakpointSplitViewOverlay
