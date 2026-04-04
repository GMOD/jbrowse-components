import {
  INSTANCE_STRIDE,
  SEQUENCE_FRAGMENT_SHADER,
  SEQUENCE_VERTEX_SHADER,
  SEQUENCE_WGSL,
  UNIFORM_BYTE_SIZE,
  interleaveSequenceInstances,
} from './sequenceShaders.ts'

import type { SequenceBackend } from './sequenceBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0

export const SEQUENCE_PASSES: PassDescriptor[] = [
  {
    id: PASS_MAIN,
    wgslSource: SEQUENCE_WGSL,
    glslVertex: SEQUENCE_VERTEX_SHADER,
    glslFragment: SEQUENCE_FRAGMENT_SHADER,
    instanceStride: INSTANCE_STRIDE * 4,
    verticesPerInstance: 6,
    blend: false,
    glAttributes: [
      {
        name: 'a_rect',
        components: 4,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
      {
        name: 'a_color',
        components: 3,
        type: 'float',
        offsetBytes: 16,
        integer: false,
      },
      {
        name: 'a_borderFlag',
        components: 1,
        type: 'float',
        offsetBytes: 28,
        integer: false,
      },
    ],
  },
]

export class GpuSequenceRenderer implements SequenceBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadGeometry(
    rectBuf: Float32Array,
    colorBuf: Uint8Array,
    instanceCount: number,
  ) {
    if (instanceCount === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }
    const interleaved = interleaveSequenceInstances(
      rectBuf,
      colorBuf,
      instanceCount,
    )
    this.hal.uploadBuffer(
      REGION_KEY,
      PASS_MAIN,
      interleaved.buffer,
      instanceCount,
    )
  }

  render(
    instanceCount: number,
    basePx: number,
    bpPerPx: number,
    cssWidth: number,
    cssHeight: number,
  ) {
    this.hal.resize(cssWidth, cssHeight)
    this.hal.beginFrame(1, 1, 1, 1)

    if (
      instanceCount > 0 &&
      this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0
    ) {
      this.uniformF32[0] = basePx
      this.uniformF32[1] = bpPerPx
      this.uniformF32[2] = cssWidth
      this.uniformF32[3] = cssHeight
      this.uniformF32[4] = 1 / bpPerPx >= 12 ? 1 : 0
      this.uniformF32[5] = 0
      this.uniformF32[6] = 0
      this.uniformF32[7] = 0
      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
