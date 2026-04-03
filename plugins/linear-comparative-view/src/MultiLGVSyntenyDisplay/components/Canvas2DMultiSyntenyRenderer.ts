import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { drawCigarOps, drawCsOps } from '@jbrowse/alignments-core'

import { BG_COLOR_HEX, LABEL_FONT_MAX, truncateGenomeName } from './multiSyntenyBackendTypes.ts'
import { getFeatureColor } from './multiSyntenyColorUtils.ts'

import type {
  MultiSyntenyCanvasBackend,
  MultiSyntenyCanvasRenderOpts,
  SyntenyColors,
} from './multiSyntenyBackendTypes.ts'
import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeDepthScale,
  downsampleMinMax,
  getDevicePixelRatio,
} from '@jbrowse/alignments-core'

import type { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

type Ctx = CanvasRenderingContext2D | SvgCanvas

function snpColorForType(colorType: number, colors: SyntenyColors) {
  if (colorType === 1) {
    return colors.baseA
  } else if (colorType === 2) {
    return colors.baseC
  } else if (colorType === 3) {
    return colors.baseG
  }
  return colors.baseT
}

function renderCoverageToCtx(
  ctx: Ctx,
  coverage: SyntenyRegionData,
  bpToPx: (refName: string, coord: number) => number | undefined,
  width: number,
  coverageHeight: number,
  coverageColor: string,
  snpColors: SyntenyColors,
) {
  const { coverageDepths, coverageMaxDepth, coverageStartOffset, regionStart, refName } = coverage
  if (coverageMaxDepth === 0) {
    return
  }

  const depthScale = computeDepthScale(coverageMaxDepth)
  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const coverageBottom = coverageHeight - YSCALEBAR_LABEL_OFFSET

  ctx.fillStyle = coverageColor

  const ds = downsampleMinMax(coverageDepths, coverageStartOffset, Math.ceil(width), coverageMaxDepth)

  for (let i = 0; i < ds.count; i++) {
    const binPos = regionStart + ds.positions[i]!
    const px = bpToPx(refName, binPos)
    const px2 = bpToPx(refName, binPos + 1)
    if (px === undefined || px2 === undefined) {
      continue
    }
    if (px > width || px2 < 0) {
      continue
    }

    const bandBottom = coverageBottom - ds.mins[i]! * depthScale * effectiveHeight
    const bandTop = coverageBottom - ds.maxs[i]! * depthScale * effectiveHeight
    ctx.fillRect(px, bandTop, Math.max(px2 - px, 1), bandBottom - bandTop)
  }

  for (let i = 0; i < coverage.snpCount; i++) {
    const pos = regionStart + coverage.snpPositions[i]!
    const px = bpToPx(refName, pos)
    const px2 = bpToPx(refName, pos + 1)
    if (px === undefined || px2 === undefined) {
      continue
    }
    if (px > width || px2 < 0) {
      continue
    }
    const yOff = coverage.snpYOffsets[i]!
    const segH = coverage.snpHeights[i]!
    const segBottom = coverageBottom - yOff * depthScale * effectiveHeight
    const segTop = segBottom - segH * depthScale * effectiveHeight
    ctx.fillStyle = snpColorForType(coverage.snpColorTypes[i]!, snpColors)
    ctx.fillRect(px, segTop, Math.max(px2 - px, 1), segBottom - segTop)
  }
}

export function renderMultiSyntenyToCtx(
  ctx: Ctx,
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  opts: MultiSyntenyCanvasRenderOpts,
) {
  const { width, height, rowHeight, rowSpacing, bpToPx, colorBy, labelW, showSnps, colors, coverageHeight, coverageRegions, coverageColor } = opts

  const showLabels = labelW > 0

  ctx.fillStyle = BG_COLOR_HEX
  ctx.fillRect(0, 0, width, coverageHeight + height)

  if (coverageHeight > 0) {
    for (const coverage of coverageRegions) {
      renderCoverageToCtx(ctx, coverage, bpToPx, width, coverageHeight, coverageColor, colors)
    }
  }

  for (let g = 0; g < displayedGenomes.length; g++) {
    const genomeName = displayedGenomes[g]!
    const y = coverageHeight + g * rowHeight
    const features = genomeRows.get(genomeName) ?? []

    if (g % 2 === 0) {
      ctx.fillStyle = '#f8f8f8'
      ctx.fillRect(0, y, width, rowHeight)
    }

    const padding = rowSpacing ? 1 : 0
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

      const clippedX = Math.max(px1, 0)
      const clippedW = Math.min(blockWidth, width - clippedX)
      const fy = y + padding
      const fh = rowHeight - padding * 2

      ctx.fillStyle = getFeatureColor(feat, colorBy)
      ctx.fillRect(clippedX, fy, clippedW, fh)

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

    if (rowHeight >= 4) {
      ctx.strokeStyle = '#e0e0e0'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, y + rowHeight)
      ctx.lineTo(width, y + rowHeight)
      ctx.stroke()
    }
  }

  // Re-draw sidebar area on top of features so genome labels are not
  // obscured by features that extend into the label region
  if (showLabels) {
    ctx.fillStyle = BG_COLOR_HEX
    ctx.fillRect(0, coverageHeight, labelW, height)
    for (let g = 0; g < displayedGenomes.length; g++) {
      const y = coverageHeight + g * rowHeight
      if (g % 2 === 0) {
        ctx.fillStyle = '#f8f8f8'
        ctx.fillRect(0, y, labelW, rowHeight)
      }
      ctx.fillStyle = '#333'
      ctx.font = `${Math.min(rowHeight - 4, LABEL_FONT_MAX)}px sans-serif`
      ctx.textBaseline = 'middle'
      const genomeName = displayedGenomes[g]!
      const displayName = truncateGenomeName(genomeName)
      ctx.fillText(displayName, 4, y + rowHeight / 2)
      if (rowHeight >= 4) {
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(0, y + rowHeight)
        ctx.lineTo(labelW, y + rowHeight)
        ctx.stroke()
      }
    }
  }
}

export class Canvas2DMultiSyntenyRenderer implements MultiSyntenyCanvasBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  resize(width: number, height: number) {
    const dpr = getDevicePixelRatio()
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
  }

  render(
    genomeRows: Map<string, MultiPairFeature[]>,
    displayedGenomes: string[],
    opts: MultiSyntenyCanvasRenderOpts,
  ) {
    const dpr = getDevicePixelRatio()
    this.resize(opts.width, opts.height + opts.coverageHeight)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMultiSyntenyToCtx(this.ctx, genomeRows, displayedGenomes, opts)
  }

  dispose() {
    // nothing to clean up for Canvas2D
  }
}
