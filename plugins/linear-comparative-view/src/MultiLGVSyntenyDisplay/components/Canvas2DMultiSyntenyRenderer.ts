import {
  bpToScreenPx,
  clipBlockForCanvas,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'

import { drawCoverageCanvas } from '../features/coverage/drawCanvas.ts'
import { packCoverageForGpu } from '../features/coverage/packGpu.ts'
import { drawFillCanvas } from '../features/fill/drawCanvas.ts'
import { prepareBlockGeometry } from '../features/fill/packGpu.ts'
import { drawIndicatorCanvas } from '../features/indicator/drawCanvas.ts'
import { packIndicatorsForGpu } from '../features/indicator/packGpu.ts'
import { drawSnpCoverageCanvas } from '../features/snpCoverage/drawCanvas.ts'
import { packSnpCoverageForGpu } from '../features/snpCoverage/packGpu.ts'
import {
  BG_COLOR_HEX,
  LABEL_FONT_MAX,
  LABEL_TEXT,
  ROW_BG_ALT,
  ROW_DIVIDER,
  truncateGenomeName,
} from '../shared/types.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyRenderState,
  MultiSyntenySources,
} from './rendererTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface RegionData {
  geometry: { buffer: ArrayBuffer; instanceCount: number } | null
  coverage: { buffer: ArrayBuffer; binCount: number; maxDepth: number } | null
  snp: { buffer: ArrayBuffer; segmentCount: number } | null
  indicators: { buffer: ArrayBuffer; indicatorCount: number } | null
}

function drawRowBackgrounds(
  ctx: Ctx2D,
  numGenomes: number,
  coverageHeight: number,
  rowHeight: number,
  width: number,
) {
  ctx.fillStyle = ROW_BG_ALT
  for (let g = 0; g < numGenomes; g += 2) {
    ctx.fillRect(0, coverageHeight + g * rowHeight, width, rowHeight)
  }
}

function drawRowDividers(
  ctx: Ctx2D,
  numGenomes: number,
  coverageHeight: number,
  rowHeight: number,
  width: number,
) {
  if (rowHeight < 4) {
    return
  }
  ctx.strokeStyle = ROW_DIVIDER
  ctx.lineWidth = 0.5
  for (let g = 0; g < numGenomes; g++) {
    const y = coverageHeight + (g + 1) * rowHeight
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

function drawGenomeLabels(
  ctx: Ctx2D,
  displayedGenomes: string[],
  coverageHeight: number,
  labelW: number,
  rowHeight: number,
  height: number,
) {
  ctx.fillStyle = BG_COLOR_HEX
  ctx.fillRect(0, coverageHeight, labelW, height)
  drawRowBackgrounds(
    ctx,
    displayedGenomes.length,
    coverageHeight,
    rowHeight,
    labelW,
  )

  const fontSize = Math.min(rowHeight - 4, LABEL_FONT_MAX)
  ctx.fillStyle = LABEL_TEXT
  ctx.font = `${fontSize}px sans-serif`
  ctx.textBaseline = 'middle'
  for (let g = 0; g < displayedGenomes.length; g++) {
    const y = coverageHeight + g * rowHeight
    ctx.fillText(truncateGenomeName(displayedGenomes[g]!), 4, y + rowHeight / 2)
  }

  drawRowDividers(
    ctx,
    displayedGenomes.length,
    coverageHeight,
    rowHeight,
    labelW,
  )
}

/**
 * Pure builder: turns the model's observable per-region inputs (raw RPC
 * payloads) plus gpuProps into a regions map of pre-packed buffers. The
 * on-screen Canvas2DMultiSyntenyRenderer.sync calls this directly, and so
 * does renderSvg.tsx — on-screen and SVG export share one builder.
 */
export function buildSyntenyRegionMap(
  sources: MultiSyntenySources,
): Map<number, RegionData> {
  const { rpcDataMap, gpuProps, palette } = sources
  const {
    displayedGenomes,
    colorBy,
    showSnps,
    showCoverage,
    coverageGlobalMax,
    viewWidth,
  } = gpuProps
  const out = new Map<number, RegionData>()
  for (const [idx, data] of rpcDataMap) {
    const geometry = prepareBlockGeometry(
      data.genomeFeatures,
      displayedGenomes,
      colorBy,
      showSnps,
      palette.syntenyColors,
    )
    const coverage = showCoverage
      ? {
          ...packCoverageForGpu(
            data.coverageDepths,
            data.coverageStartPos,
            coverageGlobalMax,
            viewWidth,
          ),
          maxDepth: data.coverageMaxDepth,
        }
      : null
    const snp = showCoverage
      ? packSnpCoverageForGpu(
          data.snpPositions,
          data.snpYOffsets,
          data.snpHeights,
          data.snpColorTypes,
          data.snpCount,
        )
      : null
    const indicators = showCoverage
      ? packIndicatorsForGpu(data.indicatorPositions, data.numIndicators)
      : null
    out.set(idx, { geometry, coverage, snp, indicators })
  }
  return out
}

/**
 * Pure draw entry point. Takes any 2D-canvas-like context (real
 * CanvasRenderingContext2D or SvgCanvas) plus a prepared regions map and
 * paints the multi-synteny display: row backgrounds, coverage, SNPs,
 * indicators, fill features, dividers, and genome name labels.
 *
 * No `this`, no DOM, no DPR scaling — just data → ctx. The on-screen
 * Canvas2DMultiSyntenyRenderer wraps this with prepareCanvas + lifecycle
 * upload state; renderSvg.tsx calls it directly with an SvgCanvas via
 * paintLayer.
 */
export function drawSyntenyBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, RegionData>,
  blocks: RenderBlock[],
  state: MultiSyntenyRenderState,
) {
  const {
    canvasWidth,
    canvasHeight,
    rowHeight,
    rowSpacing,
    coverageHeight,
    palette,
    displayedGenomes,
    labelW,
  } = state

  ctx.fillStyle = BG_COLOR_HEX
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const rowPadding = rowSpacing ? 1 : 0
  const numGenomes = displayedGenomes.length

  drawRowBackgrounds(ctx, numGenomes, coverageHeight, rowHeight, canvasWidth)

  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    if (!region) {
      continue
    }
    const clip = clipBlockForCanvas(block, canvasWidth)
    if (!clip) {
      continue
    }

    const [bpStart, bpEnd] = block.bpRangeX
    const bpToX = (absBp: number) =>
      bpToScreenPx(
        absBp,
        bpStart,
        bpEnd,
        block.screenStartPx,
        block.screenEndPx,
        block.reversed,
      )

    if (coverageHeight > 0) {
      if (region.coverage) {
        drawCoverageCanvas(
          ctx,
          region.coverage,
          bpToX,
          canvasWidth,
          coverageHeight,
          palette.coverageColorHex,
        )
      }
      if (region.snp) {
        drawSnpCoverageCanvas(
          ctx,
          region.snp,
          bpToX,
          canvasWidth,
          coverageHeight,
          palette.syntenyColors,
        )
      }
      if (region.indicators) {
        drawIndicatorCanvas(
          ctx,
          region.indicators,
          bpToX,
          canvasWidth,
          palette.syntenyColors.insertion,
        )
      }
    }

    if (region.geometry) {
      drawFillCanvas(
        ctx,
        region.geometry,
        bpToX,
        canvasWidth,
        coverageHeight,
        rowHeight,
        rowPadding,
      )
    }
  }

  drawRowDividers(ctx, numGenomes, coverageHeight, rowHeight, canvasWidth)

  if (labelW > 0) {
    drawGenomeLabels(
      ctx,
      displayedGenomes,
      coverageHeight,
      labelW,
      rowHeight,
      canvasHeight - coverageHeight,
    )
  }

  return true
}

/**
 * One-shot pure entry point: build a regions map from observable sources
 * and paint into any 2D-context-shaped surface (real canvas for raster,
 * SvgCanvas for vector). Used by SVG export as a single call. Mirrors
 * `drawAlignmentsToCtx` from plugins/alignments.
 */
export function drawSyntenyToCtx(
  ctx: Ctx2D,
  sources: MultiSyntenySources,
  blocks: RenderBlock[],
  state: MultiSyntenyRenderState,
) {
  return drawSyntenyBlocks(ctx, buildSyntenyRegionMap(sources), blocks, state)
}

/**
 * On-screen Canvas2D backend. Thin shell: `sync` rebuilds the regions map
 * via the same pure `buildSyntenyRegionMap` the SVG path uses; on-screen
 * and export can't drift. `renderBlocks` paints via the pure
 * `drawSyntenyBlocks` entry point. Mirrors Canvas2DAlignmentsRenderer.
 */
export class Canvas2DMultiSyntenyRenderer implements MultiSyntenyBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions: ReadonlyMap<number, RegionData> = new Map()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  sync(sources: MultiSyntenySources) {
    this.regions = buildSyntenyRegionMap(sources)
  }

  renderBlocks(blocks: RenderBlock[], state: MultiSyntenyRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    return drawSyntenyBlocks(this.ctx, this.regions, blocks, state)
  }

  dispose() {
    this.regions = new Map()
  }
}
