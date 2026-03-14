import type { VariantRenderBlock } from './WebGLVariantRenderer.ts'

interface Canvas2DRegionData {
  regionStart: number
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint8Array
  cellShapeTypes: Uint8Array
  numCells: number
}

export class Canvas2DVariantRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private regions = new Map<number, Canvas2DRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint8Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ) {
    if (data.numCells === 0) {
      this.regions.delete(regionNumber)
      return
    }
    this.regions.set(regionNumber, {
      regionStart: data.regionStart,
      cellPositions: data.cellPositions,
      cellRowIndices: data.cellRowIndices,
      cellColors: data.cellColors,
      cellShapeTypes: data.cellShapeTypes,
      numCells: data.numCells,
    })
  }

  pruneStaleRegions(activeRegionNumbers: number[]) {
    const active = new Set(activeRegionNumbers)
    for (const regionNumber of this.regions.keys()) {
      if (!active.has(regionNumber)) {
        this.regions.delete(regionNumber)
      }
    }
  }

  renderBlocks(
    blocks: VariantRenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ) {
    const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region || region.numCells === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const bpLength = block.bpRangeX[1] - block.bpRangeX[0]

      ctx.save()
      ctx.beginPath()
      ctx.rect(scissorX, 0, scissorW, canvasHeight)
      ctx.clip()

      for (let i = 0; i < region.numCells; i++) {
        const startBp = region.cellPositions[i * 2]! + region.regionStart
        const endBp = region.cellPositions[i * 2 + 1]! + region.regionStart
        const rowIdx = region.cellRowIndices[i]!
        const shapeType = region.cellShapeTypes[i]!

        const x1 =
          block.screenStartPx +
          ((startBp - block.bpRangeX[0]) / bpLength) * fullBlockWidth
        const x2 =
          block.screenStartPx +
          ((endBp - block.bpRangeX[0]) / bpLength) * fullBlockWidth
        const y = rowIdx * rowHeight - scrollTop
        const w = Math.max(2, x2 - x1)

        if (y + rowHeight < 0 || y > canvasHeight) {
          continue
        }

        const ci = i * 4
        const r = region.cellColors[ci]!
        const g = region.cellColors[ci + 1]!
        const b = region.cellColors[ci + 2]!
        const a = region.cellColors[ci + 3]! / 255

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`

        if (shapeType === 0) {
          ctx.fillRect(x1, y, w, rowHeight)
        } else if (shapeType === 1) {
          ctx.beginPath()
          ctx.moveTo(x1, y)
          ctx.lineTo(x1 + w, y + rowHeight / 2)
          ctx.lineTo(x1, y + rowHeight)
          ctx.fill()
        } else if (shapeType === 2) {
          ctx.beginPath()
          ctx.moveTo(x1 + w, y)
          ctx.lineTo(x1, y + rowHeight / 2)
          ctx.lineTo(x1 + w, y + rowHeight)
          ctx.fill()
        } else if (shapeType === 3) {
          ctx.beginPath()
          ctx.moveTo(x1, y)
          ctx.lineTo(x1 + w, y)
          ctx.lineTo(x1 + w / 2, y + rowHeight)
          ctx.fill()
        }
      }

      ctx.restore()
    }
  }

  destroy() {
    this.regions.clear()
  }
}
