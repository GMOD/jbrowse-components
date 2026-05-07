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
