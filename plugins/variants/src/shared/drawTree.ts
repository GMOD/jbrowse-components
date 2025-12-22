import { LegendBarModel } from './components/types'

export function drawTree({
  model,
  ctx,
}: {
  model: LegendBarModel
  ctx: CanvasRenderingContext2D
}) {
  const { treeAreaWidth, hierarchy, scrollTop, height } = model
  // Clear the entire canvas
  ctx.resetTransform()
  ctx.scale(2, 2)
  ctx.clearRect(0, 0, treeAreaWidth, height)

  // Translate to simulate scrolling
  ctx.translate(0, -scrollTop)

  // Draw the tree (this draws the full tree, but only visible part shows)
  // Note: accessing totalHeight ensures we redraw when row height changes
  ctx.strokeStyle = '#0008'
  ctx.lineWidth = 1

  // Use single path for all tree lines for better performance
  ctx.beginPath()
  if (hierarchy) {
    for (const link of hierarchy.links()) {
      const { source, target } = link
      const sy = source.x!
      const ty = target.x!
      const tx = target.y!
      const sx = source.y!

      // Vertical line
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, ty)

      // Horizontal line
      ctx.moveTo(sx, ty)
      ctx.lineTo(tx, ty)
    }
  }
  ctx.stroke()
}
