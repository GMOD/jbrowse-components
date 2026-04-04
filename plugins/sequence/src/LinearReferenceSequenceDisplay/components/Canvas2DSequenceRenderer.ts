import type { SequenceBackend } from './sequenceBackendTypes.ts'

export class Canvas2DSequenceRenderer implements SequenceBackend {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rectBuf: Float32Array | null = null
  private colorBuf: Uint8Array | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  uploadGeometry(
    rectBuf: Float32Array,
    colorBuf: Uint8Array,
    _instanceCount: number,
  ) {
    this.rectBuf = rectBuf
    this.colorBuf = colorBuf
  }

  render(
    instanceCount: number,
    basePx: number,
    bpPerPx: number,
    cssWidth: number,
    cssHeight: number,
  ) {
    const { ctx, rectBuf: rects, colorBuf: colors } = this
    if (!rects || !colors) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(cssWidth * dpr)
    const bufH = Math.round(cssHeight * dpr)
    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    const showBorders = 1 / bpPerPx >= 12

    for (let i = 0; i < instanceCount; i++) {
      const ri = i * 4
      const xBp = rects[ri]!
      const yPx = rects[ri + 1]!
      const widthBp = rects[ri + 2]!
      const heightPx = rects[ri + 3]!

      const widthPx = Math.max(widthBp / bpPerPx, 1)
      const xPx = xBp / bpPerPx + basePx

      if (xPx + widthPx < 0 || xPx > cssWidth) {
        continue
      }

      const r = colors[ri]!
      const g = colors[ri + 1]!
      const b = colors[ri + 2]!
      const hasBorder = colors[ri + 3]! > 254

      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(xPx, yPx, widthPx, heightPx)

      if (showBorders && hasBorder) {
        ctx.strokeStyle = 'rgb(85,85,85)'
        ctx.lineWidth = 1
        ctx.strokeRect(xPx, yPx, widthPx, heightPx)
      }
    }
  }

  dispose() {
    this.rectBuf = null
    this.colorBuf = null
  }
}
