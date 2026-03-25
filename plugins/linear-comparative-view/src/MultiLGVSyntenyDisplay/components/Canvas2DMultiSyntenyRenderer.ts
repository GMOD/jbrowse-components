import { parseCigar2 } from '@jbrowse/plugin-alignments'

import {
  drawCigarOps,
  drawCsOps,
  getFeatureColor,
} from './multiSyntenyColorUtils.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'
import type {
  MultiSyntenyCanvasBackend,
  MultiSyntenyCanvasRenderOpts,
} from './multiSyntenyBackendTypes.ts'
import { LABEL_FONT_MAX } from './multiSyntenyBackendTypes.ts'

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
    const { width, height, rowHeight, bpToPx, colorBy, labelW, showSnps } = opts
    const showLabels = labelW > 0
    const ctx = this.ctx

    const dpr = window.devicePixelRatio || 1
    this.resize(width, height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ededed'
    ctx.fillRect(0, 0, width, height)

    let totalFeaturesDrawn = 0
    let totalFeaturesSkipped = 0
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
          genomeName.length > 15 ? genomeName.slice(0, 12) + '...' : genomeName
        ctx.fillText(displayName, 4, y + rowHeight / 2)
      }

      const padding = rowHeight >= 6 ? 1 : 0
      for (const feat of features) {
        const px1 = bpToPx(feat.origRefName, feat.start)
        const px2 = bpToPx(feat.origRefName, feat.end)
        if (px1 === undefined || px2 === undefined) {
          totalFeaturesSkipped++
          continue
        }
        const x1 = px1 + labelW
        const x2 = px2 + labelW
        const blockWidth = Math.max(x2 - x1, 1)

        if (x1 + blockWidth < labelW || x1 > width) {
          totalFeaturesSkipped++
          continue
        }
        totalFeaturesDrawn++

        const clippedX = Math.max(x1, labelW)
        const clippedW = Math.min(blockWidth, width - clippedX)
        const fy = y + padding
        const fh = rowHeight - padding * 2

        ctx.fillStyle = getFeatureColor(feat, colorBy)
        ctx.fillRect(clippedX, fy, clippedW, fh)

        if (showSnps) {
          const bpLen = feat.end - feat.start
          if (feat.cs) {
            drawCsOps(ctx, feat.cs, x1, fy, blockWidth, fh, bpLen)
          } else if (feat.cigar) {
            drawCigarOps(
              ctx,
              parseCigar2(feat.cigar),
              x1,
              fy,
              blockWidth,
              fh,
              bpLen,
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
    console.log(
      '[Canvas2DRenderer] Render complete:',
      'drawn:', totalFeaturesDrawn,
      'skipped (no bpToPx or off-screen):', totalFeaturesSkipped,
      'genomes:', displayedGenomes.length,
      'canvas:', this.canvas.width, 'x', this.canvas.height,
    )
    if (totalFeaturesSkipped > 0 && totalFeaturesDrawn === 0) {
      const firstGenome = displayedGenomes[0]
      const features = firstGenome ? genomeRows.get(firstGenome) : undefined
      if (features && features.length > 0) {
        const f = features[0]!
        const px1 = bpToPx(f.origRefName, f.start)
        console.log(
          '[Canvas2DRenderer] DEBUG: all features skipped! Sample feature:',
          'origRefName:', f.origRefName,
          'start:', f.start,
          'end:', f.end,
          'bpToPx result:', px1,
        )
      }
    }
  }

  dispose() {
    // nothing to clean up for Canvas2D
  }
}
