import {
  bpToScreenPx,
  getDpr,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { normalizedRgbToCss } from '@jbrowse/core/util/colorBits'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '@jbrowse/plugin-wiggle'

const TWO_PI = Math.PI * 2
const POINT_RADIUS_PX = 2

export class Canvas2DManhattanRenderer implements WiggleBackend {
  private canvas: HTMLCanvasElement
  private regionData = new Map<number, SourceRenderData[]>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  uploadRegion(displayedRegionIndex: number, sources: SourceRenderData[]) {
    const total = sources.reduce((n, s) => n + s.numFeatures, 0)
    if (total === 0) {
      this.regionData.delete(displayedRegionIndex)
    } else {
      this.regionData.set(displayedRegionIndex, sources)
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionData, activeRegions)
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    const { canvasWidth, canvasHeight, domainY, scaleType } = state
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      return
    }

    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const dpr = getDpr()
    const pr = POINT_RADIUS_PX * dpr
    const normalize = makeScoreNormalizer(domainY[0], domainY[1], scaleType === 1)

    for (const block of blocks) {
      const sources = this.regionData.get(block.displayedRegionIndex)
      if (!sources) {
        continue
      }
      const [bpStart, bpEnd] = block.bpRangeX
      const { screenStartPx, screenEndPx, reversed } = block

      ctx.save()
      ctx.beginPath()
      ctx.rect(
        screenStartPx * dpr,
        0,
        (screenEndPx - screenStartPx) * dpr,
        canvasHeight * dpr,
      )
      ctx.clip()

      for (const source of sources) {
        ctx.fillStyle = normalizedRgbToCss(source.color)
        ctx.beginPath()
        const { featurePositions, featureScores, numFeatures } = source
        for (let i = 0; i < numFeatures; i++) {
          const x =
            bpToScreenPx(
              featurePositions[i * 2]!,
              bpStart,
              bpEnd,
              screenStartPx,
              screenEndPx,
              reversed,
            ) * dpr
          const y = (1 - normalize(featureScores[i]!)) * canvasHeight * dpr
          ctx.moveTo(x + pr, y)
          ctx.arc(x, y, pr, 0, TWO_PI)
        }
        ctx.fill()
      }

      ctx.restore()
    }
  }

  dispose() {
    this.regionData.clear()
  }
}
