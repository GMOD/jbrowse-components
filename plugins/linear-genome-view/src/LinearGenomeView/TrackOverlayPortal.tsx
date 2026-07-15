import { use } from 'react'

import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import { TrackOverlayContext } from './TrackOverlayContext.ts'

// Portals floating track chrome (legends, badges, on-canvas overlays) into the
// TrackContainer's overlay node, which is mounted *above* the inter-region
// padding masks (elided/boundary/region-separator blocks). A display's own
// React tree is sealed in a `contain:strict` sandbox those masks paint over, so
// anything rendered inline there gets buried at whole-genome / multi-region
// scale. Wrapping it here lifts it above the masks without the display knowing
// how the LGV lays them out — the single reusable answer to that recurring
// problem (previously re-solved per-display: MultiWiggleLegendOverlay,
// FloatingLegend).
//
// The overlay node is `pointer-events:none` (so it doesn't eat canvas
// events), and that does NOT change here — children that should capture hover
// (any interactive legend/panel) must set `pointer-events:auto` on their own
// positioned box, or hovering them falls through to feature tooltips / click
// actions on the canvas below. It can't be defaulted here: the value must live
// on the positioned element itself, and full-span SVG overlays deliberately
// stay `none` except on their sub-content (see MultiWiggleLegendOverlay).
//
// `TrackOverlayContext` is null outside a TrackContainer (some tests, or a
// display used standalone). `fallbackInline` (default) then renders the children
// in place, preserving behavior for chrome that is still meaningful without the
// escape (e.g. FloatingLegend). Pass `fallbackInline={false}` for chrome that
// only makes sense above the masks and has its own non-masked path elsewhere
// (e.g. the multi-wiggle overlay legend, whose SVG-export path draws its own).
export const TrackOverlayPortal = observer(function TrackOverlayPortal({
  children,
  fallbackInline = true,
}: {
  children: React.ReactNode
  fallbackInline?: boolean
}) {
  const overlayEl = use(TrackOverlayContext)
  return overlayEl
    ? createPortal(children, overlayEl)
    : fallbackInline
      ? children
      : null
})
