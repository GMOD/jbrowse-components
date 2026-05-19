import {
  bpToScreenPx,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { abgrBlue, abgrGreen, abgrRed } from '@jbrowse/core/util/colorBits'

import type {
  ManhattanBackend,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

const TWO_PI = Math.PI * 2
const POINT_RADIUS_PX = 2

function abgrToCss(abgr: number) {
  return `rgb(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)})`
}

// Pure draw entry point — used both by on-screen streaming render and SVG
// export. Mirrors `drawWiggleBlocks` in shape so the SVG pipeline can call
// it the same way.
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

// One-shot entry point for SVG export. Mirrors `drawWiggleToCtx`.
export function drawManhattanToCtx(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, ManhattanRpcResult>,
  blocks: WiggleRenderBlock[],
  state: ManhattanRenderState,
) {
  drawManhattanBlocks(ctx, regions, blocks, state)
}

// Streaming on-screen backend.
export class Canvas2DManhattanRenderer implements ManhattanBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions = new Map<number, ManhattanRpcResult>()

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.canvas = canvas
    this.ctx = ctx
  }

  uploadRegion(displayedRegionIndex: number, data: ManhattanRpcResult) {
    if (data.numFeatures === 0) {
      this.regions.delete(displayedRegionIndex)
    } else {
      this.regions.set(displayedRegionIndex, data)
    }
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: ManhattanRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawManhattanBlocks(this.ctx, this.regions, blocks, state)
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  dispose() {
    this.regions.clear()
  }
}
