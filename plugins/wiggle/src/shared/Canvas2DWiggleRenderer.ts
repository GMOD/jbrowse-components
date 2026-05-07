import {
  bpToScreenPx,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import { makeDensityRgbStringFn } from './getDensityColor.ts'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  SCALE_TYPE_LOG,
} from './wiggleComponentUtils.ts'
import { computeNumRows } from './wiggleInstanceBuffer.ts'
import {
  WIGGLE_FUDGE_FACTOR,
  WIGGLE_MIN_PX,
  makeScoreNormalizer,
} from '../util.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface Canvas2DRegionData {
  sources: SourceRenderData[]
  numRows: number
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

function drawXYPlot(
  ctx: Ctx2D,
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
  const positions = source.featurePositions
  const scores = source.featureScores
  const [bpStart, bpEnd] = block.bpRangeX
  const { screenStartPx, screenEndPx, reversed } = block
  const n = source.numFeatures
  for (let i = 0; i < n; i++) {
    const x1 = bpToScreenPx(
      positions[i * 2]!,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      positions[i * 2 + 1]!,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const scoreY = scoreToY(scores[i]!) + rowTop
    const w = Math.max(WIGGLE_MIN_PX, x2 - x1 + WIGGLE_FUDGE_FACTOR)
    const h = originY - scoreY
    if (h >= 0) {
      ctx.fillRect(x1, scoreY, w, h)
    } else {
      ctx.fillRect(x1, originY, w, -h)
    }
  }
}

function drawDensity(
  ctx: Ctx2D,
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
  const colorFn = makeDensityRgbStringFn(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
    r,
    g,
    b,
  )
  const positions = source.featurePositions
  const scores = source.featureScores
  const [bpStart, bpEnd] = block.bpRangeX
  const { screenStartPx, screenEndPx, reversed } = block
  const n = source.numFeatures
  for (let i = 0; i < n; i++) {
    const x1 = bpToScreenPx(
      positions[i * 2]!,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      positions[i * 2 + 1]!,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const w = Math.max(WIGGLE_MIN_PX, x2 - x1 + WIGGLE_FUDGE_FACTOR)
    ctx.fillStyle = colorFn(scores[i]!)
    ctx.fillRect(x1, rowTop, w, rowHeight)
  }
}

// Single connected polyline per contiguous run of features. moveTo only at
// the start of a new run (first feature, or whenever there's a gap to the
// previous feature). Inside a run we lineTo through (x1,scoreY)→(x2,scoreY)
// for each feature; the implicit continuation between iterations draws the
// vertical step at the junction. Drop-to-zero is just another lineTo when
// the next feature is non-adjacent.
function drawLine(
  ctx: Ctx2D,
  source: SourceRenderData,
  block: WiggleRenderBlock,
  rowHeight: number,
  rowTop: number,
  domainY: [number, number],
  scaleType: number,
  rgb: string,
) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = rgb
  ctx.lineWidth = 1
  ctx.beginPath()
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType)
  const zeroY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const [bpStart, bpEnd] = block.bpRangeX
  const { screenStartPx, screenEndPx, reversed } = block

  let inRun = false
  for (let i = 0; i < n; i++) {
    const startBp = positions[i * 2]!
    const endBp = positions[i * 2 + 1]!
    const x1 = bpToScreenPx(
      startBp,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      endBp,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const scoreY = scoreToY(scores[i]!) + rowTop

    if (!inRun) {
      ctx.moveTo(x1, zeroY)
      ctx.lineTo(x1, scoreY)
      inRun = true
    } else {
      ctx.lineTo(x1, scoreY)
    }
    ctx.lineTo(x2, scoreY)

    const nextStartBp =
      i < n - 1 ? positions[(i + 1) * 2]! : -1
    const gapAfter = nextStartBp !== endBp
    if (gapAfter) {
      ctx.lineTo(x2, zeroY)
      inRun = false
    }
  }
  ctx.stroke()
}

function drawScatter(
  ctx: Ctx2D,
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
  const positions = source.featurePositions
  const scores = source.featureScores
  const [bpStart, bpEnd] = block.bpRangeX
  const { screenStartPx, screenEndPx, reversed } = block
  const n = source.numFeatures
  for (let i = 0; i < n; i++) {
    const x1 = bpToScreenPx(
      positions[i * 2]!,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const x2 = bpToScreenPx(
      positions[i * 2 + 1]!,
      bpStart,
      bpEnd,
      screenStartPx,
      screenEndPx,
      reversed,
    )
    const scoreY = scoreToY(scores[i]!) + rowTop
    const w = Math.max(WIGGLE_MIN_PX, x2 - x1)
    ctx.fillRect(x1, scoreY - 1, w, 2)
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
