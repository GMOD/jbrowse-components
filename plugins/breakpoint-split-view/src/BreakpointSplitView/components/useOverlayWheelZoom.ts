import { useEffect } from 'react'

import { createWheelZoomController } from '@jbrowse/core/util/wheelZoom'

import type { BreakpointViewModel } from '../model.ts'

// Row geometry can't shift within a frame, so one measurement pass serves every
// wheel event in it. Measuring per event instead forces a synchronous reflow per
// container per event, which is what the rest of this path goes out of its way
// to avoid.
const MEASURE_TTL_MS = 16

// Only fires when the pointer is over an overlay path: the overlay <div> paints
// below the views (which sit inside a position:relative wrapper), so it's the
// z-index:100 <svg>'s pointer-events:auto paths that receive the wheel. Every
// other point in the view goes to the LGV's own `useWheelZoom`, and both run the
// same createWheelZoomController so the gesture behaves identically.
export function useOverlayWheelZoom(
  divRef: React.RefObject<HTMLDivElement | null>,
  views: BreakpointViewModel['views'],
) {
  useEffect(() => {
    const div = divRef.current
    if (!div || views.length === 0) {
      return undefined
    }
    // Scope the scan to the grid parent the overlay shares with the views: a
    // document-wide query also matches the track containers of every other view
    // open in the session, and indexing that list by level zooms the wrong view.
    const root = div.parentElement ?? document
    function trackContainers() {
      return root.querySelectorAll<HTMLElement>(
        '[data-testid="tracksContainer"]',
      )
    }

    let measuredAt: number | undefined
    let rows: { top: number; bottom: number }[] = []

    // The overlay is a CSS grid sibling of the views, not a child, so
    // event.target doesn't identify which view was scrolled. We resolve the view
    // by matching the cursor's Y against each track container's row, falling
    // back to the first view when it lands between rows.
    function viewIndexAtY(timeStamp: number, clientY: number) {
      if (measuredAt === undefined || timeStamp - measuredAt > MEASURE_TTL_MS) {
        measuredAt = timeStamp
        rows = [...trackContainers()]
          .slice(0, views.length)
          .map(el => el.getBoundingClientRect())
      }
      const index = rows.findIndex(
        row => clientY >= row.top && clientY <= row.bottom,
      )
      return index === -1 ? 0 : index
    }

    return createWheelZoomController({
      element: div,
      resolveTarget: event => {
        const overSvg = (event.target as Element).closest('svg')
        const index = overSvg
          ? viewIndexAtY(event.timeStamp, event.clientY)
          : -1
        const view = views[index]
        return view
          ? {
              views: [view],
              scrollZoom: view.scrollZoom,
              originElement: () => trackContainers()[index],
            }
          : undefined
      },
    })
  }, [views, divRef])
}
