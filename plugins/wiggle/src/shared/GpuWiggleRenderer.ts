import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import {
  COLOR_RAMP_LUT_ENTRIES,
  uploadColorRampLut,
} from '@jbrowse/render-core/colorRampLut'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
} from '@jbrowse/wiggle-core'

import { densityRampLut } from './densityColorRamp.ts'
import * as wiggleShader from './shaders/wiggle.generated.ts'
import * as wiggleDensityShader from './shaders/wiggleDensity.generated.ts'
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
const PASS_DENSITY = 'density'
const PASS_LINE = 'line'
const PASS_LINE_CENTER = 'lineCenter'

// What the density pass binds while `densityColorRamp` is 'default':
// wiggleDensity.slang declares its ramp sampler unconditionally (a shader
// cannot conditionally own a binding), and a textured pass with no texture
// never draws on the WebGPU HAL — so default mode binds these inert bytes,
// which the `densityRampLut` uniform flag keeps unsampled.
const UNUSED_RAMP = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4)

// Three shaders, four triangle-list passes. PASS_FILL draws xyplot / scatter as
// 6-vert quads off the 20-byte `WiggleFillInstance` record; PASS_DENSITY draws
// density off that same buffer through the composed rowRect shape
// (wiggleDensity.slang — same record, declared once in wiggleCommon); PASS_LINE
// draws the thick step-line as `STEP_LINE_VERTS` per feature (3 square-capped
// quad segments) so stroke thickness honors the lineWidth uniform (line-list
// topology can't — its width is hard-locked to 1px on WebGPU/WebGL);
// PASS_LINE_CENTER draws the connect-points line as a 6-vert capsule per
// feature under max blend. Passes sharing a record share one buffer; the fill
// family cannot join the line family, because the fill record is the one
// without the neighbour fields.
//
// The step-line's count is the shader's — its `vs_main` splits `SV_VertexID` by
// the same numbers — rather than the 18 that used to be re-typed here with
// nothing checking it against the split.

// One buffer per instance layout, so two of the four passes carry a packer.
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
  // Density: the composed rowRect × scoreScale shape over PASS_FILL's buffer
  // (same shader-declared record, so no packer and no buffer of its own — the
  // sharing rule PASS_LINE_CENTER uses on the line side).
  slangPass({
    id: PASS_DENSITY,
    mod: wiggleDensityShader,
  }),
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
  // layout its rendering actually draws. PASS_DENSITY reads PASS_FILL's and
  // PASS_LINE_CENTER reads PASS_LINE's via drawPass's bufferPassId rather than
  // carrying buffers of their own.
  protected regionPasses = [FILL_PASS, LINE_PASS]

  // The LUT currently uploaded as the density pass's texture, by the ramp
  // table's stable identity (densityRampLut caches per name). Per-pass, not
  // per-region — it mirrors the one texture the HAL holds for the pass, so a
  // ramp that hasn't changed costs a frame nothing and a change is exactly one
  // upload through the shared path.
  private boundDensityRamp: Uint8Array | undefined

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
      : renderingType === RENDERING_TYPE_DENSITY
        ? PASS_DENSITY
        : PASS_FILL

    // Density's named ramp resolves here — a name off the render state into
    // the cached LUT the Canvas2D painter indexes too — and reaches the GPU as
    // a uniform flag plus, below, the pass's texture. Never the instance
    // buffer: the score→colour mapping moving must not re-upload a byte.
    const rampLut =
      passId === PASS_DENSITY ? densityRampLut(state.densityColorRamp) : null
    if (passId === PASS_DENSITY) {
      const ramp = rampLut ?? UNUSED_RAMP
      if (ramp !== this.boundDensityRamp) {
        uploadColorRampLut(this.hal, ramp, [PASS_DENSITY])
        this.boundDensityRamp = ramp
      }
    }

    // Any module's packer serves: all three wiggle entry shaders share
    // `wiggleCommon.slang`'s uniform block, so the generated `Uniforms` are one
    // block — the same reason `UNIFORMS_SIZE_BYTES` above is read off one of
    // them.
    wiggleShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      scaleType: state.scaleType,
      symlogConstant: state.symlogConstant,
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
      // Screen density, so a fragment measuring a true CSS-px distance can size
      // its ramp to one OUTPUT pixel without differentiating it. `getDpr()` and
      // not `clip.pxH / canvasHeight`, matching the dotplot and synteny
      // renderers: past the backing-store clamp the two differ, and the ramp
      // wants the density of the screen the mark is read on.
      devicePixelRatio: getDpr(),
      densityRampLut: rampLut ? 1 : 0,
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
