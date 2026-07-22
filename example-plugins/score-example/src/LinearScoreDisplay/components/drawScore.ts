import {
  bpToScreenPx,
  clipBlockForCanvas,
} from '@jbrowse/render-core/canvas2dUtils'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Pure draw function: paints the visible blocks into any 2D context. Ctx2D =
// CanvasRenderingContext2D | SvgCanvas, so the same implementation backs both
// on-screen Canvas2D rendering and SVG export.
export function drawScoreBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, ScoreRegionData>,
  blocks: RenderBlock[],
  state: ScoreRenderState,
) {
  const { canvasWidth, canvasHeight, color } = state
  ctx.fillStyle = color
  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    const clip = data ? clipBlockForCanvas(block, canvasWidth) : undefined
    if (!data || !clip) {
      continue
    }
    const { start, end, screenStartPx, screenEndPx, reversed } = block
    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()
    for (let i = 0; i < data.numFeatures; i++) {
      const left = bpToScreenPx(
        data.starts[i]!,
        start,
        end,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const right = bpToScreenPx(
        data.ends[i]!,
        start,
        end,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const h = data.scores[i]! * canvasHeight
      ctx.fillRect(
        Math.min(left, right),
        canvasHeight - h,
        Math.abs(right - left) || 1,
        h,
      )
    }
    ctx.restore()
  }
}
