import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as dotplotShader from './shaders/dotplot.generated.ts'

import type {
  DotplotBackend,
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotBackendTypes.ts'
import type { ViewProjection } from '@jbrowse/core/util/bpProjection'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_LINE = 'line'
const VERTICES_PER_INSTANCE = 6
const UNIFORMS_SIZE_BYTES = dotplotShader.UNIFORMS_SIZE_BYTES
const INSTANCE_STRIDE_F32 = dotplotShader.INSTANCE_STRIDE_F32
const F = dotplotShader.FIELD_OFFSET_F32
const U = dotplotShader.UNIFORM_OFFSET_F32
const SLOTS = dotplotShader.UNIFORM_SLOT_ARRAYS
const MAX_REGIONS = SLOTS.regionOffsetH.length

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

  uploadGeometry(displayKey: number, data: DotplotGeometryData) {
    if (data.instanceCount === 0) {
      this.hal.deleteRegion(displayKey)
      return
    }

    const n = data.instanceCount
    const buf = new ArrayBuffer(n * dotplotShader.INSTANCE_STRIDE_BYTES)
    const u = new Uint32Array(buf)

    for (let i = 0; i < n; i++) {
      const off = i * INSTANCE_STRIDE_F32
      u[off + F.x1] = data.x1s[i]!
      u[off + F.y1] = data.y1s[i]!
      u[off + F.x2] = data.x2s[i]!
      u[off + F.y2] = data.y2s[i]!
      u[off + F.xRegionIdx] = data.xRegionIdx[i]!
      u[off + F.yRegionIdx] = data.yRegionIdx[i]!
      u[off + F.color] = data.colors[i]!
    }

    this.hal.uploadBuffer(displayKey, PASS_LINE, buf, n)
  }

  deleteGeometry(displayKey: number) {
    this.hal.deleteRegion(displayKey)
  }

  render(state: DotplotRenderState) {
    const { lineWidth, trackProjections } = state
    this.hal.beginFrame(0, 0, 0, 0)

    for (const { displayKey, projH, projV } of trackProjections) {
      const u = this.uniformF32
      u[U.resolution] = this.width
      u[U.resolution + 1] = this.height
      u[U.lineWidth] = lineWidth
      u[U.bpPerPxH] = projH.bpPerPx
      u[U.bpPerPxV] = projV.bpPerPx
      u[U.hpZero] = 0
      this.writeProjection(projH, SLOTS.regionOffsetH, u)
      this.writeProjection(projV, SLOTS.regionOffsetV, u)
      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_LINE, displayKey)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }

  private writeProjection(
    proj: ViewProjection,
    slotsU32: readonly number[],
    u: Float32Array,
  ) {
    const { regionOffsetPx } = proj
    const n = Math.min(regionOffsetPx.length, MAX_REGIONS)
    for (let i = 0; i < n; i++) {
      u[slotsU32[i]!] = regionOffsetPx[i]!
    }
    for (let i = n; i < MAX_REGIONS; i++) {
      u[slotsU32[i]!] = 0
    }
  }
}

export { UNIFORMS_SIZE_BYTES as DOTPLOT_UNIFORM_BYTE_SIZE }
