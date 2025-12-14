export function strokeRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  strokeColor?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor
  }
  ctx.strokeRect(x, y, width, height)
}

export function lineToCtx(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ctx: CanvasRenderingContext2D,
  strokeColor?: string,
) {
  if (strokeColor) {
    ctx.strokeStyle = strokeColor
  }
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
