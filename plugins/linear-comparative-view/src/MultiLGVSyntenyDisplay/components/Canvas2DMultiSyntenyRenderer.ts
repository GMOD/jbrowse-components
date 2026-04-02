import { parseCigar2 } from '@jbrowse/plugin-alignments'

import { LABEL_FONT_MAX } from './multiSyntenyBackendTypes.ts'
import {
  drawCigarOps,
  drawCsOps,
  getFeatureColor,
} from './multiSyntenyColorUtils.ts'

import type {
  MultiSyntenyCanvasBackend,
  MultiSyntenyCanvasRenderOpts,
} from './multiSyntenyBackendTypes.ts'
import type { SyntenyColors } from './multiSyntenyBackendTypes.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  downsampleMinMax,
  niceNum,
} from '@jbrowse/alignments-core'

import type { SyntenyCoverageData } from './multiSyntenyGpuData.ts'
import type { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

type Ctx = CanvasRenderingContext2D | SvgCanvas

function renderCoverageToCtx(
  ctx: Ctx,
  coverageData: SyntenyCoverageData,
  bpToPx: (refName: string, coord: number) => number | undefined,
  width: number,
  coverageHeight: number,
) {
  if (coverageData.globalMaxDepth === 0) {
    return
  }

  const nicedMax = niceNum(coverageData.globalMaxDepth)
  const depthScale = coverageData.globalMaxDepth / nicedMax
  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const coverageBottom = coverageHeight - YSCALEBAR_LABEL_OFFSET

  ctx.fillStyle = '#999'

  for (const [refName, data] of coverageData.perRefName) {
    const ds = downsampleMinMax(
      data.depths,
      data.startOffset,
      Math.ceil(width),
      coverageData.globalMaxDepth,
    )

    for (let i = 0; i < ds.count; i++) {
      const binPos = data.regionStart + ds.positions[i]!
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
  }
}

export function renderMultiSyntenyToCtx(
  ctx: Ctx,
  genomeRows: Map<string, MultiPairFeature[]>,
  displayedGenomes: string[],
  opts: {
    width: number
    height: number
    rowHeight: number
    rowSpacing: boolean
    bpToPx: (refName: string, coord: number) => number | undefined
    colorBy: string
    labelW: number
    showSnps: boolean
    colors: SyntenyColors
    coverageHeight: number
    coverageData: SyntenyCoverageData | undefined
  },
) {
  const { width, height, rowHeight, rowSpacing, bpToPx, colorBy, labelW, showSnps, colors, coverageHeight, coverageData } = opts
  const showLabels = labelW > 0

  ctx.fillStyle = '#ededed'
  ctx.fillRect(0, 0, width, coverageHeight + height)

  // Draw coverage
  if (coverageHeight > 0 && coverageData) {
    renderCoverageToCtx(ctx, coverageData, bpToPx, width, coverageHeight)
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
    ctx.fillStyle = '#ededed'
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
      const displayName =
        genomeName.length > 15 ? `${genomeName.slice(0, 12)}...` : genomeName
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
    const dpr = window.devicePixelRatio || 1
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
    const dpr = window.devicePixelRatio || 1
    this.resize(opts.width, opts.height + opts.coverageHeight)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderMultiSyntenyToCtx(this.ctx, genomeRows, displayedGenomes, opts)
  }

  dispose() {
    // nothing to clean up for Canvas2D
  }
}
