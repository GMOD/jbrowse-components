import {
  bpToScreenPx,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DBackend } from '@jbrowse/core/gpu/perRegionBackend'
import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import type { ManhattanRenderState } from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

const TWO_PI = Math.PI * 2
const POINT_RADIUS_PX = 2

function abgrToCss(abgr: number) {
  return `rgb(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)})`
}

// Pure draw entry point — used both by on-screen streaming render and SVG
// export. No per-region builder layer (the rpcDataMap entries are already
// the region payload), so SVG export calls this directly rather than going
// through a `drawXxxToCtx` wrapper.
export function drawManhattanBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, ManhattanRpcResult>,
  blocks: WiggleRenderBlock[],
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
    const [bpStart, bpEnd] = block.bpRangeX
    const { screenStartPx, screenEndPx, reversed } = block
    const { positions, scores, colors, numFeatures } = data

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    // Batch by color to amortize fillStyle changes.
    let currentAbgr = colors[0]!
    ctx.fillStyle = abgrToCss(currentAbgr)
    ctx.beginPath()
    for (let i = 0; i < numFeatures; i++) {
      const abgr = colors[i]!
      if (abgr !== currentAbgr) {
        ctx.fill()
        currentAbgr = abgr
        ctx.fillStyle = abgrToCss(currentAbgr)
        ctx.beginPath()
      }
      const x = bpToScreenPx(
        positions[i]!,
        bpStart,
        bpEnd,
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

export class Canvas2DManhattanRenderer extends Canvas2DBackend<
  ManhattanRpcResult,
  ManhattanRenderState,
  WiggleRenderBlock
> {
  renderBlocks(
    blocks: WiggleRenderBlock[],
    regions: ReadonlyMap<number, ManhattanRpcResult>,
    state: ManhattanRenderState,
  ) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawManhattanBlocks(this.ctx, regions, blocks, state)
  }
}
