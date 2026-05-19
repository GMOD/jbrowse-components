import {
  clipBlock,
  writeBpRangeUniforms,
} from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as shader from './shaders/manhattan.generated.ts'

import type {
  ManhattanBackend,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

const PASS = 'point'
const U = shader.UNIFORM_OFFSET_F32
const POINT_RADIUS_PX = 2

export const MANHATTAN_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS, mod: shader, topology: 'triangle-list' }),
]

export class GpuManhattanRenderer implements ManhattanBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(shader.UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private regionCount = new Map<number, number>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(displayedRegionIndex: number, data: ManhattanRpcResult) {
    if (data.numFeatures === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      this.regionCount.delete(displayedRegionIndex)
      return
    }
    this.hal.uploadBuffer(
      displayedRegionIndex,
      PASS,
      buildInstanceBuffer(data),
      data.numFeatures,
    )
    this.regionCount.set(displayedRegionIndex, data.numFeatures)
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionCount, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: ManhattanRenderState) {
    const { canvasWidth, canvasHeight, domainY } = state
    const dpr = getDpr()
    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      if (this.hal.getBufferCount(block.displayedRegionIndex, PASS) === 0) {
        continue
      }
      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      writeBpRangeUniforms(this.uniformF32, clip, block.reversed)
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformF32[U.domainYMin] = domainY[0]
      this.uniformF32[U.domainYMax] = domainY[1]
      this.uniformF32[U.zero] = 0
      this.uniformF32[U.viewportWidth] = clip.pxW
      this.uniformF32[U.reversed] = block.reversed ? 1 : 0
      this.uniformF32[U.pointRadius] = POINT_RADIUS_PX * dpr

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS, block.displayedRegionIndex)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  dispose() {
    this.regionCount.clear()
    this.hal.dispose()
  }
}

export function buildInstanceBuffer(data: ManhattanRpcResult): ArrayBuffer {
  const n = data.numFeatures
  const buf = new ArrayBuffer(n * shader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const stride = shader.INSTANCE_STRIDE_F32
  const { positions, scores, colors } = data
  let off = 0
  for (let i = 0; i < n; i++) {
    u32[off + shader.FIELD_OFFSET_F32.absPosition] = positions[i]!
    f32[off + shader.FIELD_OFFSET_F32.score] = scores[i]!
    u32[off + shader.FIELD_OFFSET_F32.color] = colors[i]!
    off += stride
  }
  return buf
}
