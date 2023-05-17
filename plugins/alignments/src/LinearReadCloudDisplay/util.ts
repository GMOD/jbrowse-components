// avoid drawing negative width features for SVG exports
export function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  fillColor?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (fillColor) {
    ctx.fillStyle = fillColor
  }

  ctx.fillRect(x, y, width, height)
}

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
