import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
} from '@jbrowse/wiggle-core'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import * as wiggleLineShader from './shaders/wiggleLine.generated.ts'
import { packFillInstances, packLineInstances } from './wiggleInstanceBuffer.ts'

import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'

const PASS_FILL = 'fill'
const PASS_LINE = 'line'
const PASS_LINE_CENTER = 'lineCenter'

// Two shaders, three triangle-list passes. PASS_FILL draws xyplot / density /
// scatter as 6-vert quads off wiggle.slang's 20-byte record; PASS_LINE draws the
// thick step-line as `STEP_LINE_VERTS` per feature (3 square-capped quad
// segments) so stroke thickness honors the lineWidth uniform (line-list topology
// can't — its width is hard-locked to 1px on WebGPU/WebGL); PASS_LINE_CENTER
// draws the connect-points line as a 6-vert capsule per feature under max blend.
// The two line passes share wiggleLine.slang and so share one buffer; the fill
// pass cannot join them, because the record it reads is the one without the
// neighbour fields.
//
// The step-line's count is the shader's — its `vs_main` splits `SV_VertexID` by
// the same numbers — rather than the 18 that used to be re-typed here with
// nothing checking it against the split.

// One buffer per instance layout, so two of the three passes carry a packer.
// Each returns empty for the renderings that aren't its own, which releases that
// pass's buffer (an empty pack IS the release), so only the layout actually
// being drawn stays resident.
const FILL_PASS = {
  ...slangPass({
    id: PASS_FILL,
    mod: wiggleShader,
  }),
  pack: packFillInstances,
}

const LINE_PASS = {
  ...slangPass({
    id: PASS_LINE,
    mod: wiggleLineShader,
    verticesPerInstance: wiggleLineShader.STEP_LINE_VERTS,
  }),
  pack: packLineInstances,
}

export const WIGGLE_PASSES: PipelineDescriptor[] = [
  FILL_PASS,
  LINE_PASS,
  // Center-line: one 6-vert quad per feature (shares PASS_LINE's buffer — same
  // shader module, same record). Drawn with premultiplied MAX blend so the
  // analytic-AA ribbon's overlapping segments and caps union (take the higher
  // coverage) instead of accumulating into dark seams under standard src-over.
  // Valid because the target clears to transparent black and only this pass
  // draws in center-line mode.
  //
  // Stated here rather than as a `//! blend:` on wiggleLine.slang, and this is
  // the case that keeps the directive a default rather than a verdict: the two
  // passes above and below share that shader and blend differently, so a blend
  // on the module would be right for one of them and wrong for the other.
  slangPass({
    id: PASS_LINE_CENTER,
    mod: wiggleLineShader,
    blendState: { op: 'max' },
  }),
]

export class GpuWiggleRenderer
  extends GpuPerRegionRenderingBackend<SourceRenderData[], WiggleGPURenderState>
  implements WiggleRenderingBackend
{
  // One per instance layout. Both are packed for every region and one of them
  // comes back empty, which releases its buffer — so a region holds only the
  // layout its rendering actually draws. PASS_LINE_CENTER reads PASS_LINE's via
  // drawPass's bufferPassId rather than carrying a third.
  protected regionPasses = [FILL_PASS, LINE_PASS]

  constructor(hal: GpuHal) {
    super(hal, wiggleShader.UNIFORMS_SIZE_BYTES)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    sources: SourceRenderData[],
    state: WiggleGPURenderState,
  ) {
    // Off the encoded layers, not off `state` — the buffer carries only the
    // neighbor fields the rendering it was encoded for reads, so the pass has to
    // be that same rendering or it reads fields nobody wrote. The two arrive
    // through separate autoruns and the render one can fire first, so `state`
    // may already name the rendering the user just switched to while this
    // region's buffer is still the previous one; drawing the previous plot for
    // one frame is the correct stale, and the re-encode bumps renderTick behind
    // it. Empty layers mean the pass has no buffer at all (an empty pack is the
    // release), so nothing draws and `state` is as good an answer as any.
    const renderingType = sources[0]?.renderingType ?? state.renderingType
    const isLine =
      renderingType === RENDERING_TYPE_LINE ||
      renderingType === RENDERING_TYPE_LINE_CENTER
    const passId = isLine
      ? renderingType === RENDERING_TYPE_LINE
        ? PASS_LINE
        : PASS_LINE_CENTER
      : PASS_FILL

    // Either module's packer serves: wiggle.slang and wiggleLine.slang share
    // `wiggleCommon.slang`'s uniform block, so the two generated `Uniforms` are
    // the same block — the same reason `UNIFORMS_SIZE_BYTES` above is read off
    // one of them.
    wiggleShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      scaleType: state.scaleType,
      // The layers' rendering, for the same reason the pass is: it is what the
      // shader branches on, so taking it from `state` could tell a fill shader
      // to draw a rendering its module no longer contains. Buffer, pass and
      // uniform are one decision.
      renderingType,
      numRows: state.numRows,
      domainYMin: state.domainY[0],
      domainYMax: state.domainY[1],
      // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
      zero: 0,
      // viewportWidth stays in CSS units to match canvasHeight (per CLAUDE.md
      // GPU conventions). `extendToMinWidthX` divides `MIN_FILL_WIDTH_PX` by it
      // to reach clip space, so a CSS width is what makes the floor a stable 1.5
      // CSS px across DPRs rather than 1.5 DEVICE px — and `WIGGLE_MIN_PX`, the
      // Canvas2D floor, is that same generated constant.
      //
      // `clip.scissorW`, therefore, and never `clip.pxW`, which is the same span
      // in device px. GpuMafRenderer feeds `pxW` into the same-named uniform of
      // a different shader, deliberately and with its own note; the two are not
      // interchangeable.
      viewportWidth: clip.scissorW,
      scatterPointSize: state.scatterPointSize,
      lineWidth: state.lineWidth,
      origin: state.origin,
    })

    this.hal.writeUniforms(this.uniformData)
    // Each pass draws off the buffer for its own layout — the line passes share
    // PASS_LINE's, the fill pass owns PASS_FILL's.
    this.hal.drawPass(
      passId,
      block.displayedRegionIndex,
      isLine ? PASS_LINE : PASS_FILL,
    )
  }
}
