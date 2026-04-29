import {
  coverageLayout,
  downsampleMinMax,
  drawCigarOps,
  drawCsOps,
  drawIndicatorTriangle,
  getDevicePixelRatio,
  snpColorForType,
} from '@jbrowse/alignments-core'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { drawCoverageCanvas } from '../features/coverage/drawCanvas.ts'
import { packCoverageForGpu } from '../features/coverage/packGpu.ts'
import { drawFillCanvas } from '../features/fill/drawCanvas.ts'
import { prepareBlockGeometry } from '../features/fill/packGpu.ts'
import { drawIndicatorCanvas } from '../features/indicator/drawCanvas.ts'
import { packIndicatorsForGpu } from '../features/indicator/packGpu.ts'
import { drawSnpCoverageCanvas } from '../features/snpCoverage/drawCanvas.ts'
import { packSnpCoverageForGpu } from '../features/snpCoverage/packGpu.ts'
import { computeBlockRenderParams } from '../shared/blockRenderParams.ts'
import { getFeatureColor } from '../shared/colorUtils.ts'
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
  MultiSyntenyCanvasRenderOpts,
  MultiSyntenyRenderState,
  MultiSyntenySources,
} from './rendererTypes.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { SyntenyColors } from '../shared/types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

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

// renderMultiSyntenyToCtx is the SVG export path — it renders from
// high-level feature objects and a bpToPx coordinate function.
export function renderMultiSyntenyToCtx(
  ctx: Ctx2D,
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  opts: MultiSyntenyCanvasRenderOpts,
) {
  const {
    width,
    height,
    rowHeight,
    rowSpacing,
    bpToPx,
    colorBy,
    labelW,
    showSnps,
    colors,
    coverageHeight,
    coverageRegions,
    coverageColor,
  } = opts

  ctx.fillStyle = BG_COLOR_HEX
  ctx.fillRect(0, 0, width, coverageHeight + height)

  if (coverageHeight > 0) {
    for (const coverage of coverageRegions) {
      renderCoverageForSvg(
        ctx,
        coverage,
        bpToPx,
        width,
        coverageHeight,
        coverageColor,
        colors,
      )
    }
  }

  const numGenomes = displayedGenomes.length
  drawRowBackgrounds(ctx, numGenomes, coverageHeight, rowHeight, width)

  const padding = rowSpacing ? 1 : 0
  for (let g = 0; g < numGenomes; g++) {
    const genomeName = displayedGenomes[g]!
    const rowY = coverageHeight + g * rowHeight
    const features = genomeRows.get(genomeName) ?? []

    for (const feat of features) {
      const px1 = bpToPx(feat.origRefName, feat.start)
      const px2 = bpToPx(feat.origRefName, feat.end)
      if (px1 === undefined || px2 === undefined) {
        continue
      }
      const blockWidth = Math.max(px2 - px1, 1)
      if (px1 + blockWidth < 0 || px1 > width) {
        continue
      }

      const fy = rowY + padding
      const fh = rowHeight - padding * 2
      const clippedX = Math.max(px1, 0)

      ctx.fillStyle = getFeatureColor(feat, colorBy)
      ctx.fillRect(clippedX, fy, Math.min(blockWidth, width - clippedX), fh)

      if (showSnps) {
        const bpLen = feat.end - feat.start
        if (feat.cs) {
          drawCsOps(ctx, feat.cs, px1, fy, blockWidth, fh, bpLen, colors)
        } else if (feat.cigar) {
          drawCigarOps(
            ctx,
            parseCigar2(feat.cigar),
            px1,
            fy,
            blockWidth,
            fh,
            bpLen,
            colors,
          )
        }
      }
    }
  }

  drawRowDividers(ctx, numGenomes, coverageHeight, rowHeight, width)

  if (labelW > 0) {
    drawGenomeLabels(
      ctx,
      displayedGenomes,
      coverageHeight,
      labelW,
      rowHeight,
      height,
    )
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

// Coverage rendering for SVG export — reads raw SyntenyRegionData
function renderCoverageForSvg(
  ctx: Ctx2D,
  coverage: SyntenyRegionData,
  bpToPx: (refName: string, coord: number) => number | undefined,
  width: number,
  coverageHeight: number,
  coverageColor: string,
  snpColors: SyntenyColors,
) {
  const { coverageDepths, coverageMaxDepth, coverageStartPos, refName } =
    coverage
  if (coverageMaxDepth === 0) {
    return
  }

  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const ds = downsampleMinMax(
    coverageDepths,
    coverageStartPos,
    Math.ceil(width),
    coverageMaxDepth,
  )

  const refBpToPx = (bp: number) => bpToPx(refName, bp)

  ctx.fillStyle = coverageColor
  for (let i = 0; i < ds.count; i++) {
    const binPos = ds.positions[i]!
    const px = refBpToPx(binPos)
    const px2 = refBpToPx(binPos + 1)
    if (px === undefined || px2 === undefined || px > width || px2 < 0) {
      continue
    }
    const bandBottom = bottom - ds.mins[i]! * effectiveH
    const bandTop = bottom - ds.maxs[i]! * effectiveH
    ctx.fillRect(px, bandTop, Math.max(px2 - px, 1), bandBottom - bandTop)
  }

  if (coverage.snpCount <= width * 4) {
    for (let i = 0; i < coverage.snpCount; i++) {
      const px = refBpToPx(coverage.snpPositions[i]!)
      const px2 = refBpToPx(coverage.snpPositions[i]! + 1)
      if (px === undefined || px2 === undefined || px > width || px2 < 0) {
        continue
      }
      const segBottom = bottom - coverage.snpYOffsets[i]! * effectiveH
      const segTop = segBottom - coverage.snpHeights[i]! * effectiveH
      ctx.fillStyle = snpColorForType(coverage.snpColorTypes[i]!, snpColors)
      ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segBottom - segTop)
    }
  }

  ctx.fillStyle = snpColors.insertion
  for (let i = 0; i < coverage.numIndicators; i++) {
    const px = refBpToPx(coverage.indicatorPositions[i]!)
    if (px === undefined || px < 0 || px > width) {
      continue
    }
    drawIndicatorTriangle(ctx, px)
  }
}

// Unified Canvas2D renderer — implements MultiSyntenyBackend using
// pre-packed typed arrays, sharing drawing functions with alignments.

interface RegionData {
  geometry: { buffer: ArrayBuffer; instanceCount: number } | null
  coverage: { buffer: ArrayBuffer; binCount: number; maxDepth: number } | null
  snp: { buffer: ArrayBuffer; segmentCount: number } | null
  indicators: { buffer: ArrayBuffer; indicatorCount: number } | null
}

// Builds the per-region map from worker payloads + settings. Mirrors
// alignments' buildAlignmentsRegionMap — packs once per region using the
// per-feature packGpu primitives.
function buildSyntenyRegionMap(
  sources: MultiSyntenySources,
): Map<number, RegionData> {
  const {
    rpcDataMap,
    displayedGenomes,
    colorBy,
    showSnps,
    showCoverage,
    coverageGlobalMax,
    viewWidth,
    palette,
  } = sources
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

// Pure draw entry point used by both the on-screen Canvas2D backend and
// any future direct-to-ctx caller. Mirrors renderMultiSyntenyToCtx (the
// SVG export path) but consumes pre-packed per-region buffers from the
// upload pass instead of raw feature objects.
export function drawSyntenyBlocks(
  canvas: HTMLCanvasElement,
  ctx: Ctx2D,
  regions: ReadonlyMap<number, RegionData>,
  state: MultiSyntenyRenderState,
) {
  const {
    contentBlocks,
    viewOffsetPx,
    width,
    height,
    rowHeight,
    rowSpacing,
    coverageHeight,
    palette,
    displayedGenomes,
    labelW,
  } = state

  const dpr = getDevicePixelRatio()
  const pw = Math.round(width * dpr)
  const ph = Math.round(height * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = BG_COLOR_HEX
  ctx.fillRect(0, 0, width, height)

  const rowPadding = rowSpacing ? 1 : 0
  const numGenomes = displayedGenomes.length

  drawRowBackgrounds(ctx, numGenomes, coverageHeight, rowHeight, width)

  for (const block of contentBlocks) {
    if (block.displayedRegionIndex === undefined) {
      continue
    }
    const region = regions.get(block.displayedRegionIndex)
    if (!region) {
      continue
    }
    const params = computeBlockRenderParams(block, viewOffsetPx)
    if (
      params.regionScreenLeft + params.regionScreenWidth < 0 ||
      params.regionScreenLeft > width
    ) {
      continue
    }

    const bpToX = (absBp: number) =>
      params.regionScreenLeft +
      ((absBp - block.start) / params.bpRangeLen) * params.regionScreenWidth

    if (coverageHeight > 0) {
      if (region.coverage) {
        drawCoverageCanvas(
          ctx,
          region.coverage,
          bpToX,
          width,
          coverageHeight,
          palette.coverageColorHex,
        )
      }
      if (region.snp) {
        drawSnpCoverageCanvas(
          ctx,
          region.snp,
          bpToX,
          width,
          coverageHeight,
          palette.syntenyColors,
        )
      }
      if (region.indicators) {
        drawIndicatorCanvas(
          ctx,
          region.indicators,
          bpToX,
          width,
          palette.syntenyColors.insertion,
        )
      }
    }

    if (region.geometry) {
      drawFillCanvas(
        ctx,
        region.geometry,
        bpToX,
        width,
        coverageHeight,
        rowHeight,
        rowPadding,
      )
    }
  }

  drawRowDividers(ctx, numGenomes, coverageHeight, rowHeight, width)

  if (labelW > 0) {
    drawGenomeLabels(
      ctx,
      displayedGenomes,
      coverageHeight,
      labelW,
      rowHeight,
      height - coverageHeight,
    )
  }
}

export class Canvas2DMultiSyntenyRenderer implements MultiSyntenyBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
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

  renderBlocks(state: MultiSyntenyRenderState) {
    drawSyntenyBlocks(this.canvas, this.ctx, this.regions, state)
    return true
  }

  dispose() {
    this.regions = new Map()
  }
}
