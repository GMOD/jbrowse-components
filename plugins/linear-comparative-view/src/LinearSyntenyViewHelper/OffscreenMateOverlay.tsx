import { useEffect, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import {
  drawOffscreenMates,
  offscreenMateColors,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import { offscreenMateStubs } from './offscreenMateStubs.ts'

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
 * `pointerEvents: none`, so every hit test still reaches the level's canvas
 * underneath. A stub IS clickable, and that hit test lives in the level's own
 * pointer handlers (`offscreenMateHit`) rather than here: two hit paths over one
 * band is how a click comes to mean different things depending on which element
 * received it.
 *
 * The SVG export runs the same draw through `SVGOffscreenMates`, so a figure
 * carries whatever this shows.
 */
const OffscreenMateOverlay = observer(function OffscreenMateOverlay({
  model,
}: {
  model: LinearSyntenyViewHelperModel
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { color, haloColor } = offscreenMateColors(useTheme())

  useEffect(() => {
    // autorun rather than a dep array: what this draws from is MST state
    // reached through several getters, and a dep list over those is the thing
    // that goes stale silently
    return autorun(() => {
      const { parentView } = model
      const width = parentView.width
      const height = model.height
      // prepared first and unconditionally, since preparing is what CLEARS it —
      // an empty plan has to wipe the last frame's stubs rather than leave them
      const ctx = getPreparedCanvas2D(ref.current, width, height)
      if (!ctx) {
        return
      }
      for (const stub of offscreenMateStubs(model)) {
        drawOffscreenMates(ctx, { ...stub, width, height, color, haloColor })
      }
    })
  }, [model, color, haloColor])

  return (
    <canvas
      ref={ref}
      data-testid="offscreen_mate_overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    />
  )
})

export default OffscreenMateOverlay
