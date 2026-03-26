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
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

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
    const {
      width,
      height,
      rowHeight,
      bpToPx,
      colorBy,
      labelW,
      showSnps,
      colors,
    } = opts
    const showLabels = labelW > 0
    const ctx = this.ctx

    const dpr = window.devicePixelRatio || 1
    this.resize(width, height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ededed'
    ctx.fillRect(0, 0, width, height)

    for (let g = 0; g < displayedGenomes.length; g++) {
      const genomeName = displayedGenomes[g]!
      const y = g * rowHeight
      const features = genomeRows.get(genomeName) ?? []

      if (g % 2 === 0) {
        ctx.fillStyle = '#f8f8f8'
        ctx.fillRect(0, y, width, rowHeight)
      }

      if (showLabels) {
        ctx.fillStyle = '#333'
        ctx.font = `${Math.min(rowHeight - 4, LABEL_FONT_MAX)}px sans-serif`
        ctx.textBaseline = 'middle'
        const displayName =
          genomeName.length > 15 ? `${genomeName.slice(0, 12)}...` : genomeName
        ctx.fillText(displayName, 4, y + rowHeight / 2)
      }

      const padding = rowHeight >= 6 ? 1 : 0
      for (const feat of features) {
        const px1 = bpToPx(feat.origRefName, feat.start)
        const px2 = bpToPx(feat.origRefName, feat.end)
        if (px1 === undefined || px2 === undefined) {
          continue
        }
        const x1 = px1 + labelW
        const x2 = px2 + labelW
        const blockWidth = Math.max(x2 - x1, 1)

        if (x1 + blockWidth < labelW || x1 > width) {
          continue
        }

        const clippedX = Math.max(x1, labelW)
        const clippedW = Math.min(blockWidth, width - clippedX)
        const fy = y + padding
        const fh = rowHeight - padding * 2

        ctx.fillStyle = getFeatureColor(feat, colorBy)
        ctx.fillRect(clippedX, fy, clippedW, fh)

        if (showSnps) {
          const bpLen = feat.end - feat.start
          if (feat.cs) {
            drawCsOps(ctx, feat.cs, x1, fy, blockWidth, fh, bpLen, colors)
          } else if (feat.cigar) {
            drawCigarOps(
              ctx,
              parseCigar2(feat.cigar),
              x1,
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
  }

  dispose() {
    // nothing to clean up for Canvas2D
  }
}
