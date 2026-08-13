import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/maf.iface.generated.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'

const PASS_RECT = 'rect'

export const MAF_PASSES = [
  {
    ...slangPass({ id: PASS_RECT, mod: mafShader }),
    // Pre-encoded on the main thread by the per-region encode autorun
    // (`InstanceWriter`, right-sized on finish), so the pack is the handoff.
    // The shader unpacks absolute genomic coords + rowIndex + color.
    pack: (data: MafUploadPayload) => data.instanceBuffer,
  },
]

const U = UNIFORM_OFFSET_F32

export class GpuMafRenderer extends GpuPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  private uniformF32: Float32Array
  protected regionPasses = MAF_PASSES

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  protected drawRegion(
    block: MafRenderBlock,
    clip: BlockClipResult,
    _region: MafRegionData,
    state: MafGPURenderState,
  ) {
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    // viewportWidth feeds only the shader's `extendToMinWidthX` X-axis floor;
    // it never interacts with canvasHeight. Device px here gives a 1-device-px
    // minimum cell width (0.5 CSS px at dpr 2).
    //
    // NOTE: GpuMultiRowRenderer draws the same shared `rowRect` module but feeds CSS px
    // (scissorW) for a 1-CSS-px floor — it moved off pxW in e1c2585e4d to match
    // its Canvas2D `Math.max(1, ...)`. maf has no such Canvas2D floor
    // (drawMafBlocks draws cells at natural sub-pixel width), so the two are not
    // interchangeable and neither is obviously wrong. Unresolved: whether maf
    // should follow. Don't "unify" these without deciding what MAF's floor is
    // meant to be.
    this.uniformF32[U.viewportWidth] = clip.pxW
    this.uniformF32[U.zero] = 0
    this.uniformF32[U.rowHeight] = state.rowHeight
    this.uniformF32[U.rowProportion] = state.rowProportion
    // The canvas is the rows viewport, not the rows content: rows past it are
    // scrolled to, not grown into. Every other MAF layer (Canvas2D fallback,
    // overlays, tree, hit-test) shifts by the same model.scrollTop.
    this.uniformF32[U.scrollTop] = state.scrollTop

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
