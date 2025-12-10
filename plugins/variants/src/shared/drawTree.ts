export function drawTree(
  ctx: CanvasRenderingContext2D,
  hierarchy: any,
  treeAreaWidth: number,
  totalHeight: number,
) {
  ctx.clearRect(0, 0, treeAreaWidth, totalHeight)
  ctx.strokeStyle = '#0008'
  ctx.lineWidth = 1

  for (const link of hierarchy.links()) {
    const { source, target } = link
    const sy = source.x!
    const ty = target.x!
    const tx = target.y
    const sx = source.y

    // Vertical line
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx, ty)
    ctx.stroke()

    // Horizontal line
    ctx.beginPath()
    ctx.moveTo(sx, ty)
    ctx.lineTo(tx, ty)
    ctx.stroke()
  }
}
