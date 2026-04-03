import {
  DOTPLOT_VERTEX_SHADER,
  DOTPLOT_FRAGMENT_SHADER,
  dotplotShader,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  VERTS_PER_INSTANCE,
} from './dotplotShaders.ts'

import type { DotplotBackend, DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_LINE = 'line'
const REGION_KEY = 0

export const DOTPLOT_PASSES: PassDescriptor[] = [
  {
    id: PASS_LINE,
    wgslSource: dotplotShader,
    glslVertex: DOTPLOT_VERTEX_SHADER,
    glslFragment: DOTPLOT_FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTE_SIZE,
    verticesPerInstance: VERTS_PER_INSTANCE,
    blend: true,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    glAttributes: [
      { name: 'a_x1', components: 1, type: 'float', offsetBytes: 0, integer: false },
      { name: 'a_y1', components: 1, type: 'float', offsetBytes: 4, integer: false },
      { name: 'a_x2', components: 1, type: 'float', offsetBytes: 8, integer: false },
      { name: 'a_y2', components: 1, type: 'float', offsetBytes: 12, integer: false },
      { name: 'a_color', components: 4, type: 'float', offsetBytes: 16, integer: false },
    ],
  },
]

export { UNIFORM_BYTE_SIZE as DOTPLOT_UNIFORM_BYTE_SIZE }

export class GpuDotplotRenderer implements DotplotBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
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

  uploadGeometry(data: DotplotGeometryData) {
    if (data.instanceCount === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }

    const n = data.instanceCount
    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = data.x1s[i]!
      f[off + 1] = data.y1s[i]!
      f[off + 2] = data.x2s[i]!
      f[off + 3] = data.y2s[i]!
      f[off + 4] = data.colors[i * 4]!
      f[off + 5] = data.colors[i * 4 + 1]!
      f[off + 6] = data.colors[i * 4 + 2]!
      f[off + 7] = data.colors[i * 4 + 3]!
    }

    this.hal.uploadBuffer(REGION_KEY, PASS_LINE, buf, n)
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    this.uniformF32[0] = this.width
    this.uniformF32[1] = this.height
    this.uniformF32[2] = offsetX
    this.uniformF32[3] = offsetY
    this.uniformF32[4] = lineWidth
    this.uniformF32[5] = scaleX
    this.uniformF32[6] = scaleY
    this.uniformF32[7] = 0

    this.hal.beginFrame(0, 0, 0, 0)
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_LINE, REGION_KEY)
    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
