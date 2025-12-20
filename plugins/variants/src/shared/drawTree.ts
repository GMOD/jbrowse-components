import type { ClusterHierarchyNode } from './components/types'

export function drawTree(
  ctx: CanvasRenderingContext2D,
  hierarchy: ClusterHierarchyNode,
  treeAreaWidth: number,
  totalHeight: number,
) {
  ctx.clearRect(0, 0, treeAreaWidth, totalHeight)
  ctx.strokeStyle = '#0008'
  ctx.lineWidth = 1

  // Use single path for all tree lines for better performance
  ctx.beginPath()
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
  ctx.stroke()
}
