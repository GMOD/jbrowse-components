import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/manhattan.generated.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS = 'point'

export const MANHATTAN_PASSES = [
  {
    ...slangPass({
      id: PASS,
      mod: shader,
    }),
    pack: buildInstanceBuffer,
  },
]

export class GpuManhattanRenderer extends GpuPerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
> {
  protected regionPasses = MANHATTAN_PASSES

  constructor(hal: GpuHal) {
    super(hal, shader.UNIFORMS_SIZE_BYTES)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: ManhattanRpcResult,
    state: ManhattanRenderState,
  ) {
    shader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      domainYMin: state.domainY[0],
      domainYMax: state.domainY[1],
      zero: 0,
      // viewportWidth + pointRadius stay in CSS units to match canvasHeight
      // (per CLAUDE.md GPU conventions). Mixing DPR-scaled radius with
      // CSS-scaled canvasHeight produces vertically-stretched ellipses on
      // hi-DPI displays.
      viewportWidth: clip.scissorW,
      pointRadius: state.pointDiameterPx / 2,
      devicePixelRatio: getDpr(),
    })

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
