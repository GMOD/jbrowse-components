import {
  coverageLayout,
  downsampleMinMax,
  drawCigarOps,
  drawCoverageBins,
  drawCsOps,
  drawIndicatorTriangle,
  drawIndicators,
  drawSnpSegments,
  getDevicePixelRatio,
  snpColorForType,
} from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { parseCigar2 } from '@jbrowse/plugin-alignments'

import {
  BG_COLOR_HEX,
  LABEL_FONT_MAX,
  truncateGenomeName,
} from './multiSyntenyBackendTypes.ts'
import { getFeatureColor } from './multiSyntenyColorUtils.ts'
import {
  INSTANCE_BYTE_SIZE,
  computeBlockRenderParams,
} from './multiSyntenyGpuData.ts'

import type {
  MultiSyntenyBackend,
  MultiSyntenyCanvasRenderOpts,
  MultiSyntenyRenderState,
  SyntenyColors,
} from './multiSyntenyBackendTypes.ts'
import type {
  BlockCoverageUploadData,
  BlockGeometryData,
  BlockIndicatorUploadData,
  BlockSnpUploadData,
} from './multiSyntenyGpuData.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

type Ctx = CanvasRenderingContext2D | SvgCanvas

function drawRowBackgrounds(
  ctx: Ctx,
  numGenomes: number,
  coverageHeight: number,
  rowHeight: number,
  width: number,
) {
  for (let g = 0; g < numGenomes; g++) {
    if (g % 2 === 0) {
      ctx.fillStyle = '#f8f8f8'
      ctx.fillRect(0, coverageHeight + g * rowHeight, width, rowHeight)
    }
  }
}

function drawRowDividers(
  ctx: Ctx,
  numGenomes: number,
  coverageHeight: number,
  rowHeight: number,
  width: number,
) {
  if (rowHeight < 4) {
    return
  }
  ctx.strokeStyle = '#e0e0e0'
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
  ctx: Ctx,
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
  ctx: Ctx,
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
  ctx.fillStyle = '#333'
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
  ctx: Ctx,
  coverage: SyntenyRegionData,
  bpToPx: (refName: string, coord: number) => number | undefined,
  width: number,
  coverageHeight: number,
  coverageColor: string,
  snpColors: SyntenyColors,
) {
  const {
    coverageDepths,
    coverageMaxDepth,
    coverageStartOffset,
    regionStart,
    refName,
  } = coverage
  if (coverageMaxDepth === 0) {
    return
  }

  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const ds = downsampleMinMax(
    coverageDepths,
    coverageStartOffset,
    Math.ceil(width),
    coverageMaxDepth,
  )

  const refBpToPx = (bp: number) => bpToPx(refName, bp)

  ctx.fillStyle = coverageColor
  for (let i = 0; i < ds.count; i++) {
    const binPos = regionStart + ds.positions[i]!
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
      const px = refBpToPx(regionStart + coverage.snpPositions[i]!)
      const px2 = refBpToPx(regionStart + coverage.snpPositions[i]! + 1)
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
    const px = refBpToPx(regionStart + coverage.indicatorPositions[i]!)
    if (px === undefined || px < 0 || px > width) {
      continue
    }
    drawIndicatorTriangle(ctx, px)
  }
}

// Unified Canvas2D renderer — implements MultiSyntenyBackend using
// pre-packed typed arrays, sharing drawing functions with alignments.

interface RegionData {
  regionStart: number
  geometry: { buffer: ArrayBuffer; instanceCount: number } | null
  coverage: { buffer: ArrayBuffer; binCount: number; maxDepth: number } | null
  snp: { buffer: ArrayBuffer; segmentCount: number } | null
  indicators: { buffer: ArrayBuffer; indicatorCount: number } | null
}

const STRIDE = INSTANCE_BYTE_SIZE / 4

export class Canvas2DMultiSyntenyRenderer implements MultiSyntenyBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private regions = new Map<number, RegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  private ensureRegion(regionNumber: number) {
    let r = this.regions.get(regionNumber)
    if (!r) {
      r = {
        regionStart: 0,
        geometry: null,
        coverage: null,
        snp: null,
        indicators: null,
      }
      this.regions.set(regionNumber, r)
    }
    return r
  }

  uploadGeometryForBlock(
    regionNumber: number,
    data: BlockGeometryData & { regionStart: number },
  ) {
    const r = this.ensureRegion(regionNumber)
    r.regionStart = data.regionStart
    r.geometry = { buffer: data.buffer, instanceCount: data.instanceCount }
  }

  uploadCoverageForBlock(
    regionNumber: number,
    data: BlockCoverageUploadData & { regionStart: number; maxDepth: number },
  ) {
    const r = this.ensureRegion(regionNumber)
    r.regionStart = data.regionStart
    r.coverage = {
      buffer: data.buffer,
      binCount: data.binCount,
      maxDepth: data.maxDepth,
    }
  }

  uploadSnpCoverageForBlock(regionNumber: number, data: BlockSnpUploadData) {
    this.ensureRegion(regionNumber).snp = {
      buffer: data.buffer,
      segmentCount: data.segmentCount,
    }
  }

  uploadIndicatorsForBlock(
    regionNumber: number,
    data: BlockIndicatorUploadData,
  ) {
    this.ensureRegion(regionNumber).indicators = {
      buffer: data.buffer,
      indicatorCount: data.indicatorCount,
    }
  }

  clearAllBlocks() {
    this.regions.clear()
  }

  renderBlocks(state: MultiSyntenyRenderState) {
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
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = BG_COLOR_HEX
    ctx.fillRect(0, 0, width, height)

    const rowPadding = rowSpacing ? 1 : 0
    const numGenomes = displayedGenomes.length

    drawRowBackgrounds(ctx, numGenomes, coverageHeight, rowHeight, width)

    let globalMaxDepth = 0
    for (const region of this.regions.values()) {
      if (region.coverage && region.coverage.maxDepth > globalMaxDepth) {
        globalMaxDepth = region.coverage.maxDepth
      }
    }

    for (const block of contentBlocks) {
      if (block.regionNumber === undefined) {
        continue
      }
      const region = this.regions.get(block.regionNumber)
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

      // Shared drawing functions from @jbrowse/alignments-core
      if (
        coverageHeight > 0 &&
        region.coverage &&
        region.coverage.binCount > 0
      ) {
        drawCoverageBins(
          ctx,
          region.coverage.buffer,
          region.coverage.binCount,
          globalMaxDepth,
          coverageHeight,
          palette.coverageColorHex,
          bpToX,
          width,
        )
      }
      if (coverageHeight > 0 && region.snp && region.snp.segmentCount > 0) {
        drawSnpSegments(
          ctx,
          region.snp.buffer,
          region.snp.segmentCount,
          globalMaxDepth,
          coverageHeight,
          palette.syntenyColors,
          bpToX,
          width,
        )
      }
      if (
        coverageHeight > 0 &&
        region.indicators &&
        region.indicators.indicatorCount > 0
      ) {
        drawIndicators(
          ctx,
          region.indicators.buffer,
          region.indicators.indicatorCount,
          {
            insertion: palette.syntenyColors.insertion,
            softclip: palette.syntenyColors.insertion,
            hardclip: palette.syntenyColors.insertion,
          },
          bpToX,
          width,
        )
      }

      // Geometry instances
      if (region.geometry && region.geometry.instanceCount > 0) {
        const u32 = new Uint32Array(region.geometry.buffer)
        for (let i = 0; i < region.geometry.instanceCount; i++) {
          const off = i * STRIDE
          const x1 = bpToX(u32[off]!)
          const x2 = bpToX(u32[off + 1]!)
          const w = Math.max(x2 - x1, 1)
          if (x1 + w < 0 || x1 > width) {
            continue
          }
          const genomeRow = u32[off + 2]!
          const y = coverageHeight + genomeRow * rowHeight + rowPadding
          const h = rowHeight - rowPadding * 2
          ctx.fillStyle = abgrToCssRgba(u32[off + 4]!)
          ctx.fillRect(x1, y, w, h)
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
        height - coverageHeight,
      )
    }
  }

  dispose() {
    this.regions.clear()
  }
}
