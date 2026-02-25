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

const BreakpointSplitViewOverlay = observer(
  function BreakpointSplitViewOverlay({
    model,
  }: {
    model: BreakpointViewModel
  }) {
    const { classes } = useStyles()
    const { matchedTracks, views } = model
    const ref = useRef(null)
    const divRef = useRef<HTMLDivElement>(null)
    const zoomDelta = useRef(0)
    const zoomDivisor = useRef(0)
    const lastClientX = useRef(0)
    const lastViewIndex = useRef(0)
    const rafId = useRef<number | null>(null)
    const lastRafTime = useRef<number | null>(null)

    useEffect(() => {
      const div = divRef.current
      if (!div || views.length === 0) {
        return
      }

      // NOTE: This wheel handling is intrinsically linked to useWheelScroll in
      // plugins/linear-genome-view/src/LinearGenomeView/components/useWheelScroll.ts
      // If you modify the zoom normalizer or zoom logic there, you must update
      // the getNormalizer and zoom calculations below to stay in sync.

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

      function handleWheel(event: WheelEvent) {
        const target = event.target as Element
        if (!target.closest('svg')) {
          return
        }

        // Overlay is a sibling of views, so find view by Y-coordinate matching
        // instead of DOM hierarchy traversal
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
          zoomDelta.current += deltaY
          zoomDivisor.current = getNormalizer(deltaY)
          lastClientX.current = event.clientX
          lastViewIndex.current = viewIndex
        } else {
          event.preventDefault()
          targetView.horizontalScroll(deltaX)
        }

        if (rafId.current === null) {
          rafId.current = requestAnimationFrame(now => {
            const elapsed = Math.min(
              100,
              lastRafTime.current !== null ? now - lastRafTime.current : 16.67,
            )
            lastRafTime.current = now
            const maxZoomDelta = (0.2 / 16.67) * elapsed
            if (zoomDelta.current !== 0) {
              const view = views[lastViewIndex.current]
              const containers = document.querySelectorAll(
                '[data-testid="tracksContainer"]',
              )
              const container = containers[lastViewIndex.current] as
                | HTMLElement
                | undefined
              if (view?.zoomTo && container) {
                const d = Math.max(
                  -maxZoomDelta,
                  Math.min(
                    maxZoomDelta,
                    zoomDelta.current / zoomDivisor.current,
                  ),
                )
                view.zoomTo(
                  d > 0 ? view.bpPerPx * (1 + d) : view.bpPerPx / (1 - d),
                  lastClientX.current - container.getBoundingClientRect().left,
                )
              }
              zoomDelta.current = 0
            }
            rafId.current = null
          })
        }
      }

      div.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        div.removeEventListener('wheel', handleWheel)
        if (rafId.current !== null) {
          cancelAnimationFrame(rafId.current)
        }
      }
    }, [views])

    return (
      <div ref={divRef} className={classes.overlay}>
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
