/**
 * Draw a chevron shape (arrow-like) for directional features like reads
 * @param ctx - Canvas rendering context
 * @param x - X position
 * @param y - Y position
 * @param width - Width of the chevron
 * @param height - Height of the chevron
 * @param strand - Strand direction (-1 for reverse, 1 for forward)
 * @param color - Fill color
 * @param chevronWidth - Width of the chevron pointer in pixels
 * @param stroke - Optional stroke color (if not provided, no stroke is drawn)
 */
export function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  strand: number,
  color: string,
  chevronWidth: number,
  stroke?: string,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  if (strand === -1) {
    ctx.moveTo(x - chevronWidth, y + height / 2)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width, y)
    ctx.lineTo(x, y)
  } else {
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + height)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x + width + chevronWidth, y + height / 2)
    ctx.lineTo(x + width, y)
  }
  ctx.closePath()
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.stroke()
  }
}
