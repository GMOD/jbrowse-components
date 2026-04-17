import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as dotplotShader from './shaders/dotplot.generated.ts'

import type {
  DotplotBackend,
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_LINE = 'line'
const VERTICES_PER_INSTANCE = 6
const UNIFORMS_SIZE_BYTES = dotplotShader.UNIFORMS_SIZE_BYTES
const INSTANCE_STRIDE_F32 = dotplotShader.INSTANCE_STRIDE_F32
const F = dotplotShader.FIELD_OFFSET_F32
const U = dotplotShader.UNIFORM_OFFSET_F32

export const DOTPLOT_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_LINE,
    mod: dotplotShader,
    verticesPerInstance: VERTICES_PER_INSTANCE,
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

  uploadRegion(regionNumber: number, data: DotplotGeometryData) {
    if (data.instanceCount === 0) {
      this.hal.deleteRegion(regionNumber)
      return
    }

    const n = data.instanceCount
    const buf = new ArrayBuffer(n * dotplotShader.INSTANCE_STRIDE_BYTES)
    const f = new Float32Array(buf)
    const u = new Uint32Array(buf)

    for (let i = 0; i < n; i++) {
      const off = i * INSTANCE_STRIDE_F32
      f[off + F.x1] = data.x1s[i]!
      f[off + F.y1] = data.y1s[i]!
      f[off + F.x2] = data.x2s[i]!
      f[off + F.y2] = data.y2s[i]!
      u[off + F.color] = data.colors[i]!
    }

    this.hal.uploadBuffer(regionNumber, PASS_LINE, buf, n)
  }

  deleteRegion(regionNumber: number) {
    this.hal.deleteRegion(regionNumber)
  }

  render(state: DotplotRenderState) {
    const { offsetX, offsetY, lineWidth, trackScales } = state
    this.hal.beginFrame(0, 0, 0, 0)

    for (const { regionKey, scaleX, scaleY } of trackScales) {
      this.uniformF32[U.resolution] = this.width
      this.uniformF32[U.resolution + 1] = this.height
      this.uniformF32[U.offsetX] = offsetX
      this.uniformF32[U.offsetY] = offsetY
      this.uniformF32[U.lineWidth] = lineWidth
      this.uniformF32[U.scaleX] = scaleX
      this.uniformF32[U.scaleY] = scaleY
      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_LINE, regionKey)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}

export { UNIFORMS_SIZE_BYTES as DOTPLOT_UNIFORM_BYTE_SIZE }
