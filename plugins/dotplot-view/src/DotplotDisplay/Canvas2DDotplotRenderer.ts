export class Canvas2DDotplotRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private x1s: Float32Array | null = null
  private y1s: Float32Array | null = null
  private x2s: Float32Array | null = null
  private y2s: Float32Array | null = null
  private colors: Float32Array | null = null
  private instanceCount = 0
  private width = 0
  private height = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) {
      return
    }
    this.width = width
    this.height = height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
  }

  uploadGeometry(data: {
    x1s: Float32Array
    y1s: Float32Array
    x2s: Float32Array
    y2s: Float32Array
    colors: Float32Array
    instanceCount: number
  }) {
    this.x1s = data.x1s
    this.y1s = data.y1s
    this.x2s = data.x2s
    this.y2s = data.y2s
    this.colors = data.colors
    this.instanceCount = data.instanceCount
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const ctx = this.ctx

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

    if (
      this.instanceCount === 0 ||
      !this.x1s ||
      !this.y1s ||
      !this.x2s ||
      !this.y2s ||
      !this.colors
    ) {
      return
    }

    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'

    for (let i = 0; i < this.instanceCount; i++) {
      const sx1 = this.x1s[i]! * scaleX - offsetX
      const sy1 = this.height - (this.y1s[i]! * scaleY - offsetY)
      const sx2 = this.x2s[i]! * scaleX - offsetX
      const sy2 = this.height - (this.y2s[i]! * scaleY - offsetY)

      const r = Math.round(this.colors[i * 4]! * 255)
      const g = Math.round(this.colors[i * 4 + 1]! * 255)
      const b = Math.round(this.colors[i * 4 + 2]! * 255)
      const a = this.colors[i * 4 + 3]!

      ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
      ctx.beginPath()
      ctx.moveTo(sx1, sy1)
      ctx.lineTo(sx2, sy2)
      ctx.stroke()
    }
  }

  dispose() {
    this.x1s = null
    this.y1s = null
    this.x2s = null
    this.y2s = null
    this.colors = null
    this.instanceCount = 0
  }
}
