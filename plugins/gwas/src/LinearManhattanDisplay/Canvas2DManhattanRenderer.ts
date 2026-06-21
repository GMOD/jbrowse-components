import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  bpToScreenPx,
  clipBlockForCanvas,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { POINT_RADIUS_PX, scoreToY } from './manhattanRenderingBackendTypes.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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
    const { positions, ends, glyphs, scores, colors, numFeatures } = data

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    // Batch by color to amortize fillStyle changes. Point features (SNPs,
    // insertions) draw as discs; ranged SVs wider than a point draw as a bar
    // from start→end — both subpaths share the batch's single fill().
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
      const xStart = bpToScreenPx(
        positions[i]!,
        start,
        end,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const y = scoreToY(scores[i]!, domainY, canvasHeight)
      const xEnd = bpToScreenPx(
        ends[i]!,
        start,
        end,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const left = Math.min(xStart, xEnd)
      const widthPx = Math.abs(xEnd - xStart)
      if (widthPx > POINT_RADIUS_PX * 2) {
        ctx.rect(left, y - POINT_RADIUS_PX, widthPx, POINT_RADIUS_PX * 2)
      } else if (glyphs[i] === 1) {
        // Insertion: inverted triangle (apex pointing down) at the point.
        ctx.moveTo(xStart - POINT_RADIUS_PX, y - POINT_RADIUS_PX)
        ctx.lineTo(xStart + POINT_RADIUS_PX, y - POINT_RADIUS_PX)
        ctx.lineTo(xStart, y + POINT_RADIUS_PX)
        ctx.closePath()
      } else {
        ctx.moveTo(xStart + POINT_RADIUS_PX, y)
        ctx.arc(xStart, y, POINT_RADIUS_PX, 0, TWO_PI)
      }
    }
    ctx.fill()

    ctx.restore()
  }
}

export class Canvas2DManhattanRenderer extends Canvas2DPerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, ManhattanRpcResult>,
    state: ManhattanRenderState,
  ) {
    drawManhattanBlocks(this.ctx, regions, blocks, state)
  }
}
