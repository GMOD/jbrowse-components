import { observer } from 'mobx-react'

import { TrackOverlayPortal } from './TrackOverlayPortal.tsx'

// Lifts an SVG legend / chrome above the inter-region padding masks: a
// full-track, pointer-events:none <svg> portaled into the TrackContainer overlay
// node (see TrackOverlayPortal). The SVG counterpart to the HTML overlays
// (FloatingLegend, MafLegend, HicOverlayPanel) — used where the same legend
// markup is also drawn by an SVG-export path, so it must stay <svg>.
//
// Children draw in <svg> user space; the wrapping <svg> stays pointer-events:none
// so it doesn't eat canvas events, so any interactive sub-content (a dismiss
// "×", clickable swatches) must set pointer-events:auto on its own element.
// fallbackInline={false}: outside a TrackContainer it renders nothing, matching
// callers whose export path draws its own inline legend.
export const FloatingSvgOverlay = observer(function FloatingSvgOverlay({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: React.ReactNode
}) {
  return (
    <TrackOverlayPortal fallbackInline={false}>
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {children}
      </svg>
    </TrackOverlayPortal>
  )
})
