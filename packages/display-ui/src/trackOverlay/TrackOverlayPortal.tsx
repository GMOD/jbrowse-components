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
// problem (previously re-solved per-display: the multi-wiggle color key,
// FloatingLegend).
//
// The sandbox is `contain: strict`, and the obvious simplification — drop the
// containment so chrome can just out-z-index the masks and none of this is
// needed — is measured and rejected (ADR-058): it costs 2.4-4.8x paint time
// under DOM load, because the stacking context that blocks the z-index is the
// same thing that isolates the paint. See `browser-tests/probe-containment.ts`
// in jbrowse-web and the comment on `trackRenderingContainer`. The portal buys
// both.
//
// The overlay node is `pointer-events:none` (so it doesn't eat canvas
// events), and that does NOT change here — children that should capture hover
// (any interactive legend/panel) must set `pointer-events:auto` on their own
// positioned box, or hovering them falls through to feature tooltips / click
// actions on the canvas below. It can't be defaulted here: the value must live
// on the positioned element itself, and full-span SVG overlays deliberately
// stay `none` except on their sub-content (see FloatingLegend).
//
// Taking events back is all a panel has to do: the overlay node carries
// `data-gesture-owner`, so the LGV's click-drag pan already skips anything in
// this layer that can be a press target (TrackContainer). Without that, every
// panel here would separately have to know that dragging its own text pans the
// view under it — which is how it shipped, on the legend and the Hi-C panel.
// The `fallbackInline` path renders outside that node, so chrome that is
// interactive AND meaningful inline still declares its own marker.
//
// `TrackOverlayContext` is null outside a TrackContainer (some tests, or a
// display used standalone). `fallbackInline` (default) then renders the children
// in place, preserving behavior for chrome that is still meaningful without the
// escape (e.g. FloatingLegend). Pass `fallbackInline={false}` for chrome that
// only makes sense above the masks and has its own non-masked path elsewhere
// (e.g. the multi-wiggle overlay legend, whose SVG-export path draws its own).
/**
 * #api
 * Lift floating track chrome out of the display's `contain: strict` sandbox and
 * into the host's overlay node, so the LGV's inter-region masks cannot bury it
 * at multi-region scale. `TrackOverlaySlot` is the other end.
 *
 * The overlay node takes no pointer events, so anything of yours the user
 * hovers or clicks sets `pointer-events: auto` on its own positioned box.
 *
 * With no slot above it this renders the children in place (`fallbackInline`,
 * the default), which preserves chrome that is still meaningful unescaped. Pass
 * `fallbackInline={false}` for chrome that only makes sense above the masks and
 * draws itself some other way elsewhere.
 */
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
