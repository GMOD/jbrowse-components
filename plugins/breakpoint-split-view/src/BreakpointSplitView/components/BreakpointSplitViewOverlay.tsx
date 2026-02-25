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

      function handleWheel(event: WheelEvent) {
        const target = event.target as Element
        if (!target.closest('svg')) {
          return
        }

        // Overlay is a sibling of views, so find view by Y-coordinate matching
        // instead of DOM hierarchy traversal
        const allContainers = document.querySelectorAll('[data-testid="tracksContainer"]')
        if (allContainers.length === 0) {
          return
        }

        const eventY = event.clientY
        let viewIndex = 0
        let viewContainer: HTMLElement | undefined

        for (let i = 0; i < allContainers.length && i < views.length; i++) {
          const container = allContainers[i] as HTMLElement
          const rect = container.getBoundingClientRect()
          if (eventY >= rect.top && eventY <= rect.bottom) {
            viewIndex = i
            viewContainer = container
            break
          }
        }

        const targetView = views[viewIndex]
        if (!targetView?.zoomTo || !viewContainer) {
          return
        }

        event.preventDefault()

        const deltaY = event.deltaY
        const isCtrlZoom = event.ctrlKey || event.metaKey
        const containerRect = viewContainer.getBoundingClientRect()

        if (isCtrlZoom || (targetView.scrollZoom && Math.abs(deltaY) >= 10)) {
          const d = deltaY / getNormalizer(deltaY)
          targetView.zoomTo(
            d > 0 ? targetView.bpPerPx * (1 + d) : targetView.bpPerPx / (1 - d),
            event.clientX - containerRect.left,
          )
        } else if (targetView.horizontalScroll) {
          targetView.horizontalScroll(event.deltaX)
        }
      }

      div.addEventListener('wheel', handleWheel, { passive: false })
      return () => {
        div.removeEventListener('wheel', handleWheel)
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
