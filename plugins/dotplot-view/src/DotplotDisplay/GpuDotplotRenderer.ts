import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as dotplotShader from './shaders/dotplot.generated.ts'

import type {
  DotplotBackend,
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

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

export class GpuDotplotRenderer implements DotplotBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
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
      return
    }

    const n = data.instanceCount
    const buf = new ArrayBuffer(n * dotplotShader.INSTANCE_STRIDE_BYTES)
    const f = new Float32Array(buf)
    const u = new Uint32Array(buf)

    for (let i = 0; i < n; i++) {
      const off = i * INSTANCE_STRIDE_F32
      f[off + F.x1Hi] = data.x1Hi[i]!
      f[off + F.x1Lo] = data.x1Lo[i]!
      f[off + F.y1Hi] = data.y1Hi[i]!
      f[off + F.y1Lo] = data.y1Lo[i]!
      f[off + F.x2Hi] = data.x2Hi[i]!
      f[off + F.x2Lo] = data.x2Lo[i]!
      f[off + F.y2Hi] = data.y2Hi[i]!
      f[off + F.y2Lo] = data.y2Lo[i]!
      f[off + F.padH] = data.padHs[i]!
      f[off + F.padV] = data.padVs[i]!
      u[off + F.color] = data.colors[i]!
    }

    this.hal.uploadBuffer(displayKey, PASS_LINE, buf, n)
  }

  deleteGeometry(displayKey: number) {
    this.hal.deleteRegion(displayKey)
  }

  render(state: DotplotRenderState) {
    const {
      viewBpHHi,
      viewBpHLo,
      bpPerPxHInv,
      viewBpVHi,
      viewBpVLo,
      bpPerPxVInv,
      lineWidth,
      displayKeys,
    } = state
    this.hal.beginFrame(0, 0, 0, 0)
    this.uniformF32[U.resolution] = this.width
    this.uniformF32[U.resolution + 1] = this.height
    this.uniformF32[U.lineWidth] = lineWidth
    this.uniformF32[U.viewBpHHi] = viewBpHHi
    this.uniformF32[U.viewBpHLo] = viewBpHLo
    this.uniformF32[U.bpPerPxHInv] = bpPerPxHInv
    this.uniformF32[U.viewBpVHi] = viewBpVHi
    this.uniformF32[U.viewBpVLo] = viewBpVLo
    this.uniformF32[U.bpPerPxVInv] = bpPerPxVInv
    this.uniformF32[U.hpZero] = 0
    this.hal.writeUniforms(this.uniformData)
    for (const displayKey of displayKeys) {
      this.hal.drawPass(PASS_LINE, displayKey)
    }
    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}

export { UNIFORMS_SIZE_BYTES as DOTPLOT_UNIFORM_BYTE_SIZE }
