import { getContainingView } from '@jbrowse/core/util'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { ClusterHierarchyNode, HoveredTreeNode } from './components/types'
import type { Source } from './types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface TreeDrawingModel {
  treeCanvas?: HTMLCanvasElement
  mouseoverCanvas?: HTMLCanvasElement
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  scrollTop: number
  rowHeight: number
  totalHeight: number
  hoveredTreeNode?: HoveredTreeNode
  sources?: Source[]
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
          totalHeight: _totalHeight,
        } = self

        if (!treeCanvas || !hierarchy) {
          return
        }

        const ctx = treeCanvas.getContext('2d')
        if (!ctx) {
          return
        }

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
      },
      {
        name: 'TreeDraw',
      },
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
          sources,
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

        if (hierarchy && hoveredTreeNode && sources) {
          // Save the context state
          ctx.save()

          // Translate to simulate scrolling
          ctx.translate(0, -scrollTop)

          // Draw highlight rectangles for descendant leaf rows
          // Note: accessing totalHeight ensures we redraw when row height changes
          // In phased mode, each sample name may correspond to multiple rows
          // (e.g., SAMPLE1 -> SAMPLE1 HP0, SAMPLE1 HP1)
          ctx.fillStyle = 'rgba(255,165,0,0.2)'
          const descendantSet = new Set(hoveredTreeNode.descendantNames)
          for (let i = 0, l = sources.length; i < l; i++) {
            const source = sources[i]!
            if (descendantSet.has(source.name)) {
              const y = (i + 0.5) * rowHeight
              ctx.fillRect(0, y - rowHeight / 2, viewWidth, rowHeight)
            }
          }

          // Draw circle at the hovered node
          const { node } = hoveredTreeNode
          ctx.fillStyle = 'rgba(255,165,0,0.8)'
          ctx.beginPath()
          ctx.arc(node.y!, node.x!, 4, 0, 2 * Math.PI)
          ctx.fill()

          // Add a border to the circle
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
