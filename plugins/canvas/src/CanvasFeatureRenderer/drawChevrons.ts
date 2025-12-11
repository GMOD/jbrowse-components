/**
 * Draw directional chevrons along a line to indicate strand direction
 * @param ctx - Canvas rendering context
 * @param x - Starting X position
 * @param y - Y position (vertical center of the line)
 * @param width - Width of the line
 * @param strand - Strand direction (-1 for reverse, 1 for forward)
 * @param color - Stroke color for the chevrons
 * @param spacing - Spacing between chevrons (default 20)
 * @param size - Size of each chevron (default 4)
 */
export function drawChevrons(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  strand: number,
  color: string,
  spacing = 40,
  size = 4,
) {
  if (strand === 0 || width < spacing) {
    return
  }

  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.beginPath()

  const halfSize = size / 2
  const numChevrons = Math.floor(width / spacing)
  const startOffset = (width - numChevrons * spacing) / 2 + spacing / 2

  for (let i = 0; i < numChevrons; i++) {
    const cx = x + startOffset + i * spacing
    if (strand === 1) {
      // Forward strand: > shape pointing right
      ctx.moveTo(cx - halfSize, y - halfSize)
      ctx.lineTo(cx + halfSize, y)
      ctx.lineTo(cx - halfSize, y + halfSize)
    } else {
      // Reverse strand: < shape pointing left
      ctx.moveTo(cx + halfSize, y - halfSize)
      ctx.lineTo(cx - halfSize, y)
      ctx.lineTo(cx + halfSize, y + halfSize)
    }
  }

  ctx.stroke()
}
