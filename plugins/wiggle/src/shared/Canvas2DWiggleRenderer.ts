import {
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
} from './wiggleComponentUtils.ts'
import {
  drawDensity,
  drawLine,
  drawScatter,
  drawXYPlot,
} from './wiggleDrawFunctions.ts'
import { computeNumRows } from './wiggleInstanceBuffer.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '@jbrowse/wiggle-core'

interface Canvas2DRegionData {
  sources: SourceRenderData[]
  numRows: number
}

// Pure draw entry point per ARCHITECTURE.md "SVG export pipeline". Paints
// line / density / scatter / xyplot per render type, one source per row.
export function drawWiggleBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, Canvas2DRegionData>,
  blocks: WiggleRenderBlock[],
  state: WiggleGPURenderState,
) {
  const { canvasWidth, canvasHeight, renderingType, scaleType, domainY } = state

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (!region || region.sources.length === 0) {
      continue
    }
    const clip = clipBlockForCanvas(block, canvasWidth)
    if (!clip) {
      continue
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(clip.scissorX, 0, clip.scissorW, canvasHeight)
    ctx.clip()

    const rowHeight = canvasHeight / region.numRows

    for (const source of region.sources) {
      const rowTop = source.rowIndex * rowHeight
      const r = Math.round(source.color[0] * 255)
      const g = Math.round(source.color[1] * 255)
      const b = Math.round(source.color[2] * 255)
      const rgb = `rgb(${r},${g},${b})`

      if (renderingType === RENDERING_TYPE_LINE) {
        drawLine(ctx, source, block, rowHeight, rowTop, domainY, scaleType, rgb)
      } else if (renderingType === RENDERING_TYPE_DENSITY) {
        drawDensity(
          ctx,
          source,
          block,
          rowHeight,
          rowTop,
          domainY,
          scaleType,
          r,
          g,
          b,
        )
      } else if (renderingType === RENDERING_TYPE_SCATTER) {
        drawScatter(
          ctx,
          source,
          block,
          rowHeight,
          rowTop,
          domainY,
          scaleType,
          rgb,
        )
      } else {
        drawXYPlot(
          ctx,
          source,
          block,
          rowHeight,
          rowTop,
          domainY,
          scaleType,
          rgb,
        )
      }
    }
    ctx.restore()
  }
}

// Returns undefined for zero-feature regions to signal "delete from map".
function buildWiggleRegion(
  sources: SourceRenderData[],
): Canvas2DRegionData | undefined {
  let totalFeatures = 0
  for (const source of sources) {
    totalFeatures += source.numFeatures
  }
  if (totalFeatures === 0) {
    return undefined
  }
  return { sources, numRows: computeNumRows(sources) }
}

// One-shot pure entry point used by SVG export per ARCHITECTURE.md "SVG
// export pipeline". On-screen uses the streamed per-region path via
// Canvas2DWiggleRenderer because rpcDataMap entries arrive incrementally.
export function drawWiggleToCtx<Data>(
  ctx: Ctx2D,
  sources: {
    rpcDataMap: ReadonlyMap<number, Data>
    encode: (data: Data) => SourceRenderData[]
  },
  blocks: WiggleRenderBlock[],
  state: WiggleGPURenderState,
) {
  const regions = new Map<number, Canvas2DRegionData>()
  for (const [idx, data] of sources.rpcDataMap) {
    const region = buildWiggleRegion(sources.encode(data))
    if (region) {
      regions.set(idx, region)
    }
  }
  drawWiggleBlocks(ctx, regions, blocks, state)
}

// Streaming on-screen backend. `uploadRegion` is per-region (per-key
// autorun); `renderBlocks` preps the canvas and delegates to drawWiggleBlocks.
export class Canvas2DWiggleRenderer implements WiggleBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions = new Map<number, Canvas2DRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.canvas = canvas
    this.ctx = ctx
  }

  uploadRegion(displayedRegionIndex: number, sources: SourceRenderData[]) {
    const region = buildWiggleRegion(sources)
    if (region) {
      this.regions.set(displayedRegionIndex, region)
    } else {
      this.regions.delete(displayedRegionIndex)
    }
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawWiggleBlocks(this.ctx, this.regions, blocks, state)
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  dispose() {
    this.regions.clear()
  }
}
