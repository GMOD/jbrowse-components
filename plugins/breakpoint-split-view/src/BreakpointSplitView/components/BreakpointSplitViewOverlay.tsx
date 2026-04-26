import { useEffect, useRef } from 'react'

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

// NOTE: These helpers mirror the zoom normalizer in
// plugins/linear-genome-view/src/LinearGenomeView/components/useWheelScroll.ts
// Keep them in sync if you change the zoom logic there.
function getNormalizer(deltaY: number) {
  const abs = Math.abs(deltaY)
  if (abs < 6) {
    return 25
  }
  if (abs > 150) {
    return 500
  }
  if (abs > 30) {
    return 150
  }
  return 75
}

function normalizeWheel(delta: number, mode: number) {
  if (mode === 1) {
    return delta * 16
  }
  if (mode === 2) {
    return delta * 100
  }
  return delta
}

interface WheelState {
  zoomDelta: number
  zoomDivisor: number
  lastClientX: number
  lastViewIndex: number
  rafId: number | null
  lastRafTime: number | null
}

const BreakpointSplitViewOverlay = observer(
  function BreakpointSplitViewOverlay({
    model,
  }: {
    model: BreakpointViewModel
  }) {
    const { classes } = useStyles()
    const { matchedTracks, views } = model
    const divRef = useRef<HTMLDivElement>(null)
    const state = useRef<WheelState>({
      zoomDelta: 0,
      zoomDivisor: 0,
      lastClientX: 0,
      lastViewIndex: 0,
      rafId: null,
      lastRafTime: null,
    })

    useEffect(() => {
      const div = divRef.current
      if (!div || views.length === 0) {
        return
      }

      const s = state.current

      function handleWheel(event: WheelEvent) {
        const target = event.target as Element
        if (!target.closest('svg')) {
          return
        }

        // The overlay is a CSS grid sibling of the views, not a child, so
        // event.target doesn't identify which view was scrolled. We resolve
        // the view by scanning all track containers and matching Y-coordinate.
        const allContainers = document.querySelectorAll(
          '[data-testid="tracksContainer"]',
        )
        if (allContainers.length === 0) {
          return
        }

        const eventY = event.clientY
        let viewIndex = 0

        for (let i = 0; i < allContainers.length && i < views.length; i++) {
          const container = allContainers[i] as HTMLElement
          const rect = container.getBoundingClientRect()
          if (eventY >= rect.top && eventY <= rect.bottom) {
            viewIndex = i
            break
          }
        }

        const targetView = views[viewIndex]
        if (!targetView?.zoomTo) {
          return
        }

        const deltaY = normalizeWheel(event.deltaY, event.deltaMode)
        const deltaX = normalizeWheel(event.deltaX, event.deltaMode)
        const isCtrlZoom = event.ctrlKey || event.metaKey

        if (
          isCtrlZoom ||
          (targetView.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))
        ) {
          event.preventDefault()
          s.zoomDelta += deltaY
          s.zoomDivisor = getNormalizer(deltaY)
          s.lastClientX = event.clientX
          s.lastViewIndex = viewIndex
        } else {
          event.preventDefault()
          targetView.horizontalScroll(deltaX)
        }

        if (s.rafId === null) {
          s.rafId = requestAnimationFrame(now => {
            const elapsed = Math.min(
              100,
              s.lastRafTime !== null ? now - s.lastRafTime : 16.67,
            )
            s.lastRafTime = now
            const maxZoomDelta = (0.2 / 16.67) * elapsed
            if (s.zoomDelta !== 0) {
              const view = views[s.lastViewIndex]
              const containers = document.querySelectorAll(
                '[data-testid="tracksContainer"]',
              )
              const container = containers[s.lastViewIndex] as
                | HTMLElement
                | undefined
              if (view?.zoomTo && container) {
                const d = Math.max(
                  -maxZoomDelta,
                  Math.min(maxZoomDelta, s.zoomDelta / s.zoomDivisor),
                )
                view.zoomTo(
                  d > 0 ? view.bpPerPx * (1 + d) : view.bpPerPx / (1 - d),
                  s.lastClientX - container.getBoundingClientRect().left,
                )
              }
              s.zoomDelta = 0
            }
            s.rafId = null
          })
        }
      }

      div.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        div.removeEventListener('wheel', handleWheel)
        if (s.rafId !== null) {
          cancelAnimationFrame(s.rafId)
        }
      }
    }, [views])

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
