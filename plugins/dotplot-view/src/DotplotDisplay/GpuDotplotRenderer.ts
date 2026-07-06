import { slangPass } from '@jbrowse/render-core/slangPass'

import * as dotplotShader from './shaders/dotplot.generated.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
  DotplotRenderingBackend,
} from './dotplotRenderingBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

const PASS_LINE = 'line'
const UNIFORMS_SIZE_BYTES = dotplotShader.UNIFORMS_SIZE_BYTES
const INSTANCE_STRIDE_F32 = dotplotShader.INSTANCE_STRIDE_F32
const F = dotplotShader.FIELD_OFFSET_F32
const U = dotplotShader.UNIFORM_OFFSET_F32

export const DOTPLOT_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_LINE,
    mod: dotplotShader,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

// Per-axis fetch-time base cumBp, kept per display so render() can fold the
// (base - viewBp) pan delta into the panPx uniform for each display's buffer.
interface AxisBase {
  baseH: number
  baseV: number
}

export class GpuDotplotRenderer implements DotplotRenderingBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private baseByKey = new Map<number, AxisBase>()
  private width = 0
  private height = 0

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.hal.resize(width, height)
  }

  uploadGeometry(displayKey: number, data: DotplotGeometryData) {
    if (data.instanceCount === 0) {
      this.hal.deleteRegion(displayKey)
      this.baseByKey.delete(displayKey)
      return
    }

    const n = data.instanceCount
    const { baseH, baseV } = data
    const buf = new ArrayBuffer(n * dotplotShader.INSTANCE_STRIDE_BYTES)
    const f = new Float32Array(buf)
    const u = new Uint32Array(buf)

    // Store window-relative coords (cumBp - base) as single Float32 here at the
    // shader-upload boundary; render() reconstructs screen px via panPx. JS-side
    // code keeps working in absolute cumBp space.
    for (let i = 0; i < n; i++) {
      const off = i * INSTANCE_STRIDE_F32
      f[off + F.x1] = data.x1[i]! - baseH
      f[off + F.y1] = data.y1[i]! - baseV
      f[off + F.x2] = data.x2[i]! - baseH
      f[off + F.y2] = data.y2[i]! - baseV
      u[off + F.color] = data.colors[i]!
    }

    this.baseByKey.set(displayKey, { baseH, baseV })
    this.hal.uploadBuffer(displayKey, PASS_LINE, buf, n)
  }

  deleteGeometry(displayKey: number) {
    this.hal.deleteRegion(displayKey)
    this.baseByKey.delete(displayKey)
  }

  render(state: DotplotRenderState) {
    const {
      viewBpH,
      bpPerPxHInv,
      viewBpV,
      bpPerPxVInv,
      lineWidth,
      displayKeys,
    } = state
    this.hal.beginFrame(0, 0, 0, 0)
    this.uniformF32[U.resolution] = this.width
    this.uniformF32[U.resolution + 1] = this.height
    this.uniformF32[U.lineWidth] = lineWidth
    this.uniformF32[U.bpPerPxHInv] = bpPerPxHInv
    this.uniformF32[U.bpPerPxVInv] = bpPerPxVInv
    for (const displayKey of displayKeys) {
      const base = this.baseByKey.get(displayKey)
      if (!base) {
        continue
      }
      // panPx = (base - viewBp)/bpPerPx: how far the view has panned from the
      // fetch-time base, in px. Both operands are near the view (small delta),
      // so no genome-scale magnitude multiplies the rounded inv — that's what
      // keeps a single Float32 coord sub-pixel. SYNC: matches computeCorners in
      // dotplot.slang and drawDotplot's absolute reconstruction.
      this.uniformF32[U.panPxH] = (base.baseH - viewBpH) * bpPerPxHInv
      this.uniformF32[U.panPxV] = (base.baseV - viewBpV) * bpPerPxVInv
      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_LINE, displayKey)
    }
    this.hal.endFrame()
  }

  dispose() {
    this.baseByKey.clear()
    this.hal.dispose()
  }
}

export { UNIFORMS_SIZE_BYTES as DOTPLOT_UNIFORM_BYTE_SIZE }
