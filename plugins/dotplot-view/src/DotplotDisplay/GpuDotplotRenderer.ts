import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { createInstanceCache } from '@jbrowse/render-core/instanceCache'
import { GpuRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { DOTPLOT_INSTANCE_CACHE } from './instanceInterleave.ts'
import * as dotplotShader from './shaders/dotplot.generated.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
  DotplotRenderingBackend,
} from './dotplotRenderingBackendTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

const PASS_LINE = 'line'
const UNIFORMS_SIZE_BYTES = dotplotShader.UNIFORMS_SIZE_BYTES
const U = dotplotShader.UNIFORM_OFFSET_F32

export const DOTPLOT_PASSES: PipelineDescriptor[] = [
  slangPass({
    id: PASS_LINE,
    mod: dotplotShader,
  }),
]

// Per-axis fetch-time base cumBp, kept per display so render() can fold the
// (base - viewBp) pan delta into the panPx uniform for each display's buffer.
interface AxisBase {
  baseH: number
  baseV: number
}

export class GpuDotplotRenderer
  extends GpuRenderingBackendBase
  implements DotplotRenderingBackend
{
  private uniformF32: Float32Array
  private baseByKey = new Map<number, AxisBase>()
  // Packed instance bytes per display, re-packed only when the geometry moves.
  private interleaveCache = createInstanceCache(DOTPLOT_INSTANCE_CACHE)
  private width = 0
  private height = 0

  constructor(hal: GpuHal) {
    // The base owns `hal`, the reusable uniform scratch, `dispose`, and the
    // `setErrorHandler` that routes a HAL over-limit allocation to renderError
    // — which is what puts the "too much data, zoom in" banner on a dotplot too
    // big for the device, instead of a blank canvas.
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.hal.resize(width, height)
  }

  upload(displayKey: number, data: DotplotGeometryData) {
    if (data.instanceCount === 0) {
      this.release(displayKey)
      return
    }
    const { baseH, baseV, instanceCount } = data
    this.baseByKey.set(displayKey, { baseH, baseV })
    this.hal.uploadBuffer(
      displayKey,
      PASS_LINE,
      this.interleaveCache.get(displayKey, data),
      instanceCount,
    )
  }

  release(displayKey: number) {
    this.hal.deleteRegion(displayKey)
    this.baseByKey.delete(displayKey)
    this.interleaveCache.delete(displayKey)
  }

  render(state: DotplotRenderState) {
    const {
      viewBpH,
      bpPerPxHInv,
      viewBpV,
      bpPerPxVInv,
      lineWidth,
      alpha,
      displayKeys,
    } = state
    this.hal.beginFrame(0, 0, 0, 0)
    this.uniformF32[U.resolution] = this.width
    this.uniformF32[U.resolution + 1] = this.height
    this.uniformF32[U.lineWidth] = lineWidth
    this.uniformF32[U.alpha] = alpha
    this.uniformF32[U.bpPerPxHInv] = bpPerPxHInv
    this.uniformF32[U.bpPerPxVInv] = bpPerPxVInv
    // The shader measures in CSS px (this.width/height are the view's, and the
    // HAL scales the backing store by getDpr()), so it needs the ratio to size
    // its AA ramp at one output pixel — see aaHalf in dotplot.slang.
    this.uniformF32[U.devicePixelRatio] = getDpr()
    for (const displayKey of displayKeys) {
      const base = this.baseByKey.get(displayKey)
      if (!base) {
        continue
      }
      // panPx = (base - viewBp)/bpPerPx: how far the view has panned from the
      // fetch-time base, in px. Both operands are near the view (small delta),
      // so no genome-scale magnitude multiplies the rounded inv — that's what
      // keeps a single Float32 coord sub-pixel. SYNC: the `bpRel*bpPerPxInv +
      // panPx` reconstruction in dotplot.slang's vs_main, and drawDotplot's
      // equivalent from absolute cumBp.
      this.uniformF32[U.panPxH] = (base.baseH - viewBpH) * bpPerPxHInv
      this.uniformF32[U.panPxV] = (base.baseV - viewBpV) * bpPerPxVInv
      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_LINE, displayKey)
    }
    this.hal.endFrame()
  }

  override dispose() {
    this.baseByKey.clear()
    this.interleaveCache.clear()
    super.dispose()
  }
}

export { UNIFORMS_SIZE_BYTES as DOTPLOT_UNIFORM_BYTE_SIZE }
