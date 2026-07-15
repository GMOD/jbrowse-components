import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  bpToScreenPx,
  clipBlockForCanvas,
} from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { appendPointMarker } from '@jbrowse/wiggle-core'

import { scoreToY } from './manhattanRenderingBackendTypes.ts'
import { GLYPH_INDEX, GLYPH_INSERTION } from '../ManhattanRPC/rpcTypes.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
// Must match INDEX_GLYPH_SCALE in manhattan.slang: LocusZoom draws the
// index/lead SNP visibly larger than the other points. Exported so
// glyphContract.test.ts can pin the two against each other.
export const INDEX_GLYPH_SCALE = 1.6

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
  const { canvasWidth, canvasHeight, domainY, pointDiameterPx } = state
  const r = pointDiameterPx / 2

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
      if (widthPx > pointDiameterPx) {
        ctx.rect(left, y - r, widthPx, pointDiameterPx)
      } else if (glyphs[i] === GLYPH_INSERTION) {
        // Insertion: inverted triangle (apex pointing down) at the point.
        ctx.moveTo(xStart - r, y - r)
        ctx.lineTo(xStart + r, y - r)
        ctx.lineTo(xStart, y + r)
        ctx.closePath()
      } else if (glyphs[i] === GLYPH_INDEX) {
        // LD index/lead SNP: diamond (LocusZoom convention), drawn larger so
        // it reads as "the one that matters" at a glance.
        const ri = r * INDEX_GLYPH_SCALE
        ctx.moveTo(xStart, y - ri)
        ctx.lineTo(xStart + ri, y)
        ctx.lineTo(xStart, y + ri)
        ctx.lineTo(xStart - ri, y)
        ctx.closePath()
      } else {
        appendPointMarker(ctx, xStart, y, pointDiameterPx)
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
