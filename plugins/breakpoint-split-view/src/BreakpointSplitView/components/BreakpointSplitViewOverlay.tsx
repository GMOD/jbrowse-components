import { useEffect, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import Overlay from './Overlay.tsx'
import { useOverlayWheelZoom } from './useOverlayWheelZoom.ts'

import type { BreakpointViewModel } from '../model.ts'

function offsetsEqual(
  a: Record<string, number[]>,
  b: Record<string, number[]>,
) {
  const aKeys = Object.keys(a)
  if (aKeys.length !== Object.keys(b).length) {
    return false
  }
  for (const key of aKeys) {
    const av = a[key]!
    const bv = b[key]
    if (av.length !== bv?.length) {
      return false
    }
    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) {
        return false
      }
    }
  }
  return true
}

// Polls DOM positions each animation frame. Ref reads happen inside useEffect,
// not during render, so they're safe from React's concurrent-mode constraints.
// Compares against previous frame and skips setState when unchanged so the
// overlay only re-renders when DOM positions actually move.
function useDomTrackYOffsets(
  views: BreakpointViewModel['views'],
  matchedTracks: BreakpointViewModel['matchedTracks'],
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [offsets, setOffsets] = useState<Record<string, number[]>>({})
  const lastOffsets = useRef(offsets)

  useEffect(() => {
    let rafId: number
    function measure() {
      const svg = svgRef.current
      if (svg) {
        const svgTop = svg.getBoundingClientRect().top
        const next: Record<string, number[]> = {}
        for (const track of matchedTracks) {
          const { trackId } = track.configuration
          next[trackId] = views.map(
            view =>
              (view.trackRefs[trackId]?.getBoundingClientRect().top ?? svgTop) -
              svgTop,
          )
        }
        if (!offsetsEqual(lastOffsets.current, next)) {
          lastOffsets.current = next
          setOffsets(next)
        }
      }
      rafId = requestAnimationFrame(measure)
    }
    rafId = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [views, matchedTracks])

  return { svgRef, offsets }
}

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
    const { svgRef, offsets: domOffsetsByTrack } = useDomTrackYOffsets(
      views,
      matchedTracks,
    )
    const divRef = useRef<HTMLDivElement>(null)
    useOverlayWheelZoom(divRef, views)

    return (
      <div ref={divRef} className={classes.overlay}>
        <svg ref={svgRef} className={classes.base}>
          {matchedTracks.map(track => {
            const trackId = track.configuration.trackId
            return (
              <Overlay
                key={trackId}
                model={model}
                trackId={trackId}
                domYOffsets={domOffsetsByTrack[trackId]}
              />
            )
          })}
        </svg>
      </div>
    )
  },
)

export default BreakpointSplitViewOverlay
