import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import {
  drawOffscreenMates,
  offscreenMateColors,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateStrips } from './offscreenMateStrip.ts'

import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'

/**
 * The alignments this level cannot draw a ribbon for, marked on the query axis.
 *
 * ITS OWN CANVAS, over the level's. The level's canvas belongs to the rendering
 * backend and may be a WebGPU or WebGL surface, and a canvas has one context
 * type — so there is no "draw a few boxes afterwards" on it. Stacking a 2D
 * canvas is what a non-instance element costs, and it is cheap: these are
 * thousands of rects, not the millions the instance path exists for.
 *
 * NO MARKS, NO CANVAS. The setting is off by default, so mounting this
 * unconditionally allocated a band-sized DPR-scaled backing store per level for
 * a strip nobody had asked for. The SVG export has always been gated this way.
 *
 * `OverlayCanvas` rather than a `<canvas>` of its own, which is what this was
 * and is what got it wrong: a canvas is a REPLACED element, so `inset: 0` does
 * not stretch it the way it stretches a div — with no CSS width it takes its
 * intrinsic size, which `prepareCanvas` has just set to the DPR-scaled backing
 * store. On a retina display that is twice the band, so every mark and label
 * drew at twice its x and the right half of the level fell off the edge. It
 * looked plausible: a strip of marks spanning the axis, just the wrong marks.
 *
 * `pointerEvents: none`, so every hit test still reaches the level's canvas
 * underneath. A mark IS clickable, and that hit test lives in the level's own
 * pointer handlers (`offscreenMateHit`) rather than here: two hit paths over one
 * band is how a click comes to mean different things depending on which element
 * received it. That also means the pointer used the level's geometry while the
 * paint used the overlay's, so the bug above put the mark a reader saw and the
 * mark their click resolved in different places.
 *
 * The SVG export runs the same draw through `SVGOffscreenMates`, sized from the
 * export's own width rather than from a canvas, so it was right throughout.
 */
const OffscreenMateOverlay = observer(function OffscreenMateOverlay({
  model,
}: {
  model: LinearSyntenyViewHelperModel
}) {
  const { color, haloColor } = offscreenMateColors(useTheme())
  const width = model.parentView.width
  const height = model.height
  // read here rather than inside the draw: this is an observer, so what the
  // component reads while rendering is what re-renders it, and the draw closure
  // then changes identity exactly when the marks do
  const strips = offscreenMateStrips(model)

  // ONE CANVAS FOR BOTH STRIPS, not one each: they are two edges of one band,
  // and a second stacked canvas would be a second DPR-scaled backing store for
  // a few pixels of marks.
  return strips.length > 0 ? (
    <OverlayCanvas
      data-testid="offscreen_mate_overlay"
      width={width}
      height={height}
      draw={ctx => {
        for (const strip of strips) {
          drawOffscreenMates(ctx, { ...strip, width, height, color, haloColor })
        }
      }}
    />
  ) : null
})

export default OffscreenMateOverlay
