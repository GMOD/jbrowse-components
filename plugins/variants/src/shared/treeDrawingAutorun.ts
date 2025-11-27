import { getContainingView } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { addDisposer } from 'mobx-state-tree'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface TreeDrawingModel {
  treeCanvas?: HTMLCanvasElement
  mouseoverCanvas?: HTMLCanvasElement
  hierarchy?: any
  treeAreaWidth: number
  height: number
  scrollTop: number
  rowHeight: number
  totalHeight: number
  hoveredTreeNode?: {
    node: any
    descendantNames: string[]
  }
}

export function setupTreeDrawingAutorun(self: TreeDrawingModel) {
  // Draw tree structure
  addDisposer(
    self,
    autorun(
      function treeDrawAutorun() {
        const {
          treeCanvas,
          hierarchy,
          treeAreaWidth,
          height,
          scrollTop,
          // eslint-disable-next-line  @typescript-eslint/no-unused-vars
          totalHeight,
        } = self
        if (!treeCanvas || !hierarchy) {
          return
        }

        const ctx = treeCanvas.getContext('2d')
        if (!ctx) {
          return
        }

        // Clear the entire canvas
        ctx.clearRect(0, 0, treeAreaWidth, height)

        // Save the context state
        ctx.save()

        // Translate to simulate scrolling
        ctx.translate(0, -scrollTop)

        // Draw the tree (this draws the full tree, but only visible part shows)
        // Note: accessing totalHeight ensures we redraw when row height changes
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

        // Restore the context state
        ctx.restore()
      },
      { name: 'TreeDraw' },
    ),
  )

  // Draw hover highlights
  addDisposer(
    self,
    autorun(
      function treeHoverAutorun() {
        const {
          mouseoverCanvas,
          hierarchy,
          rowHeight,
          hoveredTreeNode,
          height,
          scrollTop,
          // eslint-disable-next-line  @typescript-eslint/no-unused-vars
          totalHeight,
        } = self
        if (!mouseoverCanvas) {
          return
        }

        const ctx = mouseoverCanvas.getContext('2d')
        if (!ctx) {
          return
        }

        const view = getContainingView(self) as LinearGenomeViewModel
        const viewWidth = view.width

        ctx.clearRect(0, 0, viewWidth, height)

        if (hierarchy && hoveredTreeNode) {
          // Save the context state
          ctx.save()

          // Translate to simulate scrolling
          ctx.translate(0, -scrollTop)

          // Draw highlight rectangles for descendant rows
          // Note: accessing totalHeight ensures we redraw when row height changes
          ctx.fillStyle = 'rgba(255,165,0,0.2)'
          for (const name of hoveredTreeNode.descendantNames) {
            const leaf = hierarchy
              .leaves()
              .find((l: any) => l.data.name === name)
            if (leaf) {
              const y = leaf.x!
              ctx.fillRect(0, y - rowHeight / 2, viewWidth, rowHeight)
            }
          }

          // Draw circle at the hovered node
          const { node } = hoveredTreeNode
          ctx.fillStyle = 'rgba(255,165,0,0.8)'
          ctx.beginPath()
          ctx.arc(node.y, node.x, 4, 0, 2 * Math.PI)
          ctx.fill()

          // Optional: add a border to the circle
          ctx.strokeStyle = 'rgba(255,140,0,1)'
          ctx.lineWidth = 1
          ctx.stroke()

          // Restore the context state
          ctx.restore()
        }
      },
      { name: 'TreeHover' },
    ),
  )
}
