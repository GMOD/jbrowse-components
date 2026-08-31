import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as variantShader from './shaders/variant.generated.ts'
import { interleaveVariantInstances } from './variantShaders.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const UNIFORMS_SIZE_BYTES = variantShader.UNIFORMS_SIZE_BYTES

export const VARIANT_PASSES = [
  {
    ...slangPass({
      id: PASS_MAIN,
      mod: variantShader,
    }),
    pack: interleaveVariantInstances,
  },
]

export { UNIFORMS_SIZE_BYTES as VARIANT_UNIFORM_BYTE_SIZE }

export class GpuVariantRenderer extends GpuPerRegionRenderingBackend<
  VariantUploadData,
  VariantRenderState
> {
  protected regionPasses = VARIANT_PASSES

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
  }

  protected drawRegion(
    block: VariantRenderBlock,
    clip: BlockClipResult,
    _region: VariantUploadData,
    state: VariantRenderState,
  ) {
    variantShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      // The FULL width: it anchors the pixel-snap grid, which must be the one
      // the Canvas2D/SVG painters and the hit test snap against
      // (snapVariantCellX takes model.canvasWidthPx). The clipped block's own
      // span is what clip-space x covers, and goes in viewportWidth.
      canvasWidth: state.canvasWidth,
      viewportWidth: clip.scissorW,
      rowHeight: state.rowHeight,
      scrollTop: state.scrollTop,
      zero: 0,
      devicePixelRatio: getDpr(),
    })

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_MAIN, block.displayedRegionIndex)
  }
}
