import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/manhattan.generated.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS = 'point'
const U = shader.UNIFORM_OFFSET_F32

export const MANHATTAN_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS, mod: shader, topology: 'triangle-list' }),
]

export class GpuManhattanRenderer extends GpuPerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    super(hal, shader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: ManhattanRpcResult) {
    if (data.numFeatures === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      return
    }
    this.hal.uploadBuffer(
      displayedRegionIndex,
      PASS,
      buildInstanceBuffer(data),
      data.numFeatures,
    )
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: ManhattanRpcResult,
    state: ManhattanRenderState,
  ) {
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    this.uniformF32[U.domainYMin] = state.domainY[0]
    this.uniformF32[U.domainYMax] = state.domainY[1]
    this.uniformF32[U.zero] = 0
    // viewportWidth + pointRadius stay in CSS units to match canvasHeight
    // (per CLAUDE.md GPU conventions). Mixing DPR-scaled radius with
    // CSS-scaled canvasHeight produces vertically-stretched ellipses on
    // hi-DPI displays.
    this.uniformF32[U.viewportWidth] = clip.scissorW
    this.uniformF32[U.pointRadius] = state.pointDiameterPx / 2

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS, block.displayedRegionIndex)
  }
}

export function buildInstanceBuffer(data: ManhattanRpcResult): ArrayBuffer {
  return shader.packInstances(
    {
      absPosition: data.positions,
      absEnd: data.ends,
      score: data.scores,
      color: data.colors,
      glyph: data.glyphs,
    },
    data.numFeatures,
  )
}
