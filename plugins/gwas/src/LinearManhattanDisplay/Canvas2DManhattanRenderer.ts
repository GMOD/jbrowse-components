import {
  bpToScreenPx,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import { POINT_RADIUS_PX } from './manhattanRenderingBackendTypes.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const TWO_PI = Math.PI * 2

// Pure draw entry point — used both by on-screen streaming render and SVG
// export. No per-region builder layer (the rpcDataMap entries are already
// the region payload), so SVG export calls this directly rather than going
// through a `drawXxxToCtx` wrapper.
export function drawManhattanBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, ManhattanRpcResult>,
  blocks: RenderBlock[],
  state: ManhattanRenderState,
) {
  const { canvasWidth, canvasHeight, domainY } = state
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1

  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    if (!data || data.numFeatures === 0) {
      continue
    }
    const clip = clipBlockForCanvas(block, canvasWidth)
    if (!clip) {
      continue
    }
    const { screenStartPx, screenEndPx, reversed, start, end } = block
    const { positions, scores, colors, numFeatures } = data

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    // Batch by color to amortize fillStyle changes.
    let currentAbgr = colors[0]!
    ctx.fillStyle = abgrToCssRgba(currentAbgr)
    ctx.beginPath()
    for (let i = 0; i < numFeatures; i++) {
      const abgr = colors[i]!
      if (abgr !== currentAbgr) {
        ctx.fill()
        currentAbgr = abgr
        ctx.fillStyle = abgrToCssRgba(currentAbgr)
        ctx.beginPath()
      }
      const x = bpToScreenPx(
        positions[i]!,
        start,
        end,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const norm = (scores[i]! - domainMin) / range
      const y = (1 - Math.max(0, Math.min(1, norm))) * canvasHeight
      ctx.moveTo(x + POINT_RADIUS_PX, y)
      ctx.arc(x, y, POINT_RADIUS_PX, 0, TWO_PI)
    }
    ctx.fill()

    ctx.restore()
  }
}

export class Canvas2DManhattanRenderer extends Canvas2DPerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
> {
  renderBlocks(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, ManhattanRpcResult>,
    state: ManhattanRenderState,
  ) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawManhattanBlocks(this.ctx, regions, blocks, state)
  }
}
