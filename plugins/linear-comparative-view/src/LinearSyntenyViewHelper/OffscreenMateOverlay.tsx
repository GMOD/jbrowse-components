import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import {
  drawOffscreenMates,
  offscreenMateColors,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'

import type { LinearSyntenyViewHelperModel } from './stateModelFactory.ts'

// A 2D canvas over the level's, which may be a WebGPU or WebGL surface. Both
// strips go in one draw, since their labels share the band's vertical room.
// Mounted only with something to mark: the setting is on by default, and an
// empty band-sized backing store on every level is what that would otherwise
// cost. `pointerEvents: none`, so the hit test stays with the level's own
// handlers and one band has one hit path.
const OffscreenMateOverlay = observer(function OffscreenMateOverlay({
  model,
}: {
  model: LinearSyntenyViewHelperModel
}) {
  const colors = offscreenMateColors(model.groundColor)
  const { width } = model.parentView
  const { height, offscreenMateStrips: strips } = model
  return strips.length > 0 ? (
    <OverlayCanvas
      data-testid="offscreen_mate_overlay"
      width={width}
      height={height}
      draw={ctx => {
        drawOffscreenMates(ctx, strips, colors)
      }}
    />
  ) : null
})

export default OffscreenMateOverlay
