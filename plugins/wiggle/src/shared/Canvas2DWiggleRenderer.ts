import {
  bpToScreenPx,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'


import { WIGGLE_FUDGE_FACTOR, makeScoreNormalizer } from '../util.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  SCALE_TYPE_LOG,
} from './wiggleComponentUtils.ts'
import { computeNumRows } from './wiggleInstanceBuffer.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

interface Canvas2DRegionData {
  sources: SourceRenderData[]
  numRows: number
}

interface FeatureBounds {
  x1: number
  x2: number
  score: number
}

function makeScoreToY(
  rowHeight: number,
  domainY: [number, number],
  scaleType: number,
) {
  const normalize = makeScoreNormalizer(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
  )
  return (score: number) => (1 - normalize(score)) * rowHeight
}

function featureAt(
  source: SourceRenderData,
  i: number,
  block: WiggleRenderBlock,
): FeatureBounds {
  const startBp = source.featurePositions[i * 2]!
  const endBp = source.featurePositions[i * 2 + 1]!
  const [bpStart, bpEnd] = block.bpRangeX
  return {
    x1: bpToScreenPx(
      startBp,
      bpStart,
      bpEnd,
      block.screenStartPx,
      block.screenEndPx,
      block.reversed,
    ),
    x2: bpToScreenPx(
      endBp,
      bpStart,
      bpEnd,
      block.screenStartPx,
      block.screenEndPx,
      block.reversed,
    ),
    score: source.featureScores[i]!,
  }
}

// SvgCanvas duck-types as CanvasRenderingContext2D for the methods used here,
// so the same draw path serves on-screen rendering and SVG export. Mirrors
// the pattern in plugin-alignments' Canvas2DAlignmentsRenderer.
type Ctx = CanvasRenderingContext2D | SvgCanvas

function drawXYPlot(
  ctx: Ctx,
  source: SourceRenderData,
  block: WiggleRenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const originY = scoreToY(0) + rowTop
  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, block)
    const scoreY = scoreToY(f.score) + rowTop
    const w = Math.max(1.5, f.x2 - f.x1 + WIGGLE_FUDGE_FACTOR)
    const h = originY - scoreY
    if (h >= 0) {
      ctx.fillRect(f.x1, scoreY, w, h)
    } else {
      ctx.fillRect(f.x1, originY, w, -h)
    }
  }
}

function drawDensity(
  ctx: Ctx,
  source: SourceRenderData,
  block: WiggleRenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  r: number,
  g: number,
  b: number,
) {
  const normalize = makeScoreNormalizer(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
  )
  const zeroNorm = normalize(0)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const invMaxDist = maxDist > 0.0001 ? 1 / maxDist : 0
  const rDelta = r - 255
  const gDelta = g - 255
  const bDelta = b - 255

  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, block)
    const w = Math.max(1.5, f.x2 - f.x1 + WIGGLE_FUDGE_FACTOR)
    const t = Math.abs(normalize(f.score) - zeroNorm) * invMaxDist
    const cr = (255 + rDelta * t) | 0
    const cg = (255 + gDelta * t) | 0
    const cb = (255 + bDelta * t) | 0
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`
    ctx.fillRect(f.x1, rowTop, w, rowHeight)
  }
}

function drawLine(
  ctx: Ctx,
  source: SourceRenderData,
  block: WiggleRenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  if (source.numFeatures === 0) {
    return
  }
  ctx.strokeStyle = rgb
  ctx.lineWidth = 1
  ctx.beginPath()
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)

  let prevY = scoreToY(source.featureScores[0]!) + rowTop
  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, block)
    const scoreY = scoreToY(f.score) + rowTop
    if (i > 0) {
      ctx.moveTo(f.x1, prevY)
      ctx.lineTo(f.x1, scoreY)
    }
    ctx.moveTo(f.x1, scoreY)
    ctx.lineTo(f.x2, scoreY)
    prevY = scoreY
  }
  ctx.stroke()
}

function drawScatter(
  ctx: Ctx,
  source: SourceRenderData,
  block: WiggleRenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  ctx.fillStyle = rgb
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  for (let i = 0; i < source.numFeatures; i++) {
    const f = featureAt(source, i, block)
    const scoreY = scoreToY(f.score) + rowTop
    const w = Math.max(1.5, f.x2 - f.x1)
    ctx.fillRect(f.x1, scoreY - 1, w, 2)
  }
}

/**
 * Pure draw entry point. Takes any 2D-canvas-like context (real
 * CanvasRenderingContext2D or SvgCanvas) plus a regions map and paints the
 * wiggle display: line / density / scatter / xyplot per render type, one
 * source per row.
 *
 * No `this`, no DOM, no DPR scaling — just data → ctx. The on-screen
 * `Canvas2DWiggleRenderer` wraps this with `prepareCanvas` + lifecycle upload
 * state; SVG export calls it directly with an `SvgCanvas`.
 */
export function drawWiggleBlocks(
  ctx: Ctx,
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

/**
 * Streaming-upload lifecycle holder around a `regions` Map, with the
 * `renderBlocks` lifecycle wrapper that runs `prepareCanvas` (DPR + size) and
 * delegates to the pure `drawWiggleBlocks`.
 *
 * Two construction modes:
 *
 *   1. **Bound** — `new Canvas2DWiggleRenderer(canvas)`.
 *      Used by the on-screen lifecycle (initDualBackend). `renderBlocks` works.
 *
 *   2. **Headless** — `new Canvas2DWiggleRenderer(null)`.
 *      Used by SVG export. Caller runs `uploadRegion` to fill the regions map,
 *      then calls `drawWiggleBlocks(svgCanvas, instance.getRegions(), blocks,
 *      state)` directly. `renderBlocks` throws — there's no canvas to prepare.
 */
export class Canvas2DWiggleRenderer implements WiggleBackend {
  private canvas: HTMLCanvasElement | null
  private ctx: CanvasRenderingContext2D | null
  private regions = new Map<number, Canvas2DRegionData>()

  constructor(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Canvas 2D context not available')
      }
      this.ctx = ctx
    } else {
      this.ctx = null
    }
  }

  uploadRegion(displayedRegionIndex: number, sources: SourceRenderData[]) {
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }
    if (totalFeatures === 0) {
      this.regions.delete(displayedRegionIndex)
      return
    }
    this.regions.set(displayedRegionIndex, {
      sources,
      numRows: computeNumRows(sources),
    })
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    if (!this.canvas || !this.ctx) {
      throw new Error(
        'Canvas2DWiggleRenderer.renderBlocks called without a canvas — call drawWiggleBlocks(ctx, regions, …) directly for headless rendering',
      )
    }
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawWiggleBlocks(this.ctx, this.regions, blocks, state)
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  dispose() {
    this.regions.clear()
  }

  // Expose for headless callers (SVG export) that need to drive
  // drawWiggleBlocks with an SvgCanvas after running upload methods.
  getRegions(): ReadonlyMap<number, Canvas2DRegionData> {
    return this.regions
  }
}
