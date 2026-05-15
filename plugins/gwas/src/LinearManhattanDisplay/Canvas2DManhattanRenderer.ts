import { getDpr, prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import { normalizeScore } from './normalizeScore.ts'

import type {
  ManhattanBackend,
  ManhattanRegionData,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

const TWO_PI = Math.PI * 2

export class Canvas2DManhattanRenderer implements ManhattanBackend {
  private canvas: HTMLCanvasElement
  private regionData = new Map<number, ManhattanRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  uploadRegion(displayedRegionIndex: number, data: ManhattanRegionData) {
    if (data.numFeatures === 0) {
      this.regionData.delete(displayedRegionIndex)
    } else {
      this.regionData.set(displayedRegionIndex, data)
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionData, activeRegions)
  }

  renderBlocks(blocks: RenderBlock[], state: ManhattanRenderState): boolean {
    const { canvasWidth, canvasHeight, domainY, scaleType, pointRadius } = state
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      return false
    }

    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const dpr = getDpr()
    const pr = pointRadius * dpr

    let drew = false
    for (const block of blocks) {
      const data = this.regionData.get(block.displayedRegionIndex)
      if (!data) {
        continue
      }

      const bpLength = block.bpRangeX[1] - block.bpRangeX[0]
      const blockWidth = block.screenEndPx - block.screenStartPx
      const bpPerPx = bpLength / blockWidth
      const regionStart = block.bpRangeX[0]

      // All points share one color (set by encodeRegion); extract once.
      const c = data.colors[0]!
      const r = (c >>> 0) & 0xFF
      const g = (c >>> 8) & 0xFF
      const b = (c >>> 16) & 0xFF
      const a = (c >>> 24) & 0xFF

      ctx.save()
      ctx.beginPath()
      ctx.rect(block.screenStartPx * dpr, 0, blockWidth * dpr, canvasHeight * dpr)
      ctx.clip()

      ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`
      ctx.beginPath()
      for (let i = 0; i < data.numFeatures; i++) {
        const pos = data.positions[i]!
        const score = data.scores[i]!

        const x = (block.reversed
          ? (block.bpRangeX[1] - pos) / bpPerPx + block.screenStartPx
          : (pos - regionStart) / bpPerPx + block.screenStartPx) * dpr
        const y = (1 - normalizeScore(score, domainY, scaleType)) * canvasHeight * dpr

        ctx.moveTo(x + pr, y)
        ctx.arc(x, y, pr, 0, TWO_PI)
      }
      ctx.fill()

      ctx.restore()
      drew = true
    }
    return drew
  }

  dispose() {
    this.regionData.clear()
  }
}
