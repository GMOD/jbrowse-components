import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { TREE_STROKE, links } from './hierarchy.ts'

import type { TreeDrawingModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Own the backing-store size here rather than letting React set the canvas
// width/height attributes: a React-driven resize clears the canvas, and since
// the draw autoruns fire synchronously on the state change (before React
// commits), a resize landing afterward would wipe the freshly drawn content
// with no follow-up redraw. Sizing and drawing in the same reaction keeps them
// atomic. Returns the 2d context (already sized), or null if unavailable.
function resizeCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const ctx = canvas.getContext('2d')
  if (ctx) {
    if (canvas.width !== w) {
      canvas.width = w
    }
    if (canvas.height !== h) {
      canvas.height = h
    }
  }
  return ctx
}

export function setupTreeDrawingAutorun(self: TreeDrawingModel) {
  addDisposer(
    self,
    autorun(
      function treeDrawAutorun() {
        if (!isAlive(self) || self.isMinimized) {
          return
        }
        // touch totalHeight so MobX tracks it as a dependency (row height changes)
        void self.totalHeight
        const {
          treeCanvas,
          hierarchy,
          treeAreaWidth,
          height,
          lineZoneHeight = 0,
          scrollTop = 0,
        } = self

        if (!treeCanvas || !hierarchy) {
          return
        }

        const contentHeight = height - lineZoneHeight
        const ctx = resizeCanvas(
          treeCanvas,
          treeAreaWidth * 2,
          contentHeight * 2,
        )
        if (!ctx) {
          return
        }

        ctx.resetTransform()
        ctx.scale(2, 2)
        ctx.clearRect(0, 0, treeAreaWidth, contentHeight)

        ctx.translate(0, -scrollTop)
        ctx.strokeStyle = TREE_STROKE
        ctx.lineWidth = 1

        ctx.beginPath()
        for (const link of links(hierarchy)) {
          const { source, target } = link
          const sy = source.x
          const ty = target.x
          const tx = target.y
          const sx = source.y

          ctx.moveTo(sx, sy)
          ctx.lineTo(sx, ty)

          ctx.moveTo(sx, ty)
          ctx.lineTo(tx, ty)
        }
        ctx.stroke()
      },
      { name: 'TreeDraw' },
    ),
  )

  addDisposer(
    self,
    autorun(
      function treeHoverAutorun() {
        if (!isAlive(self) || self.isMinimized) {
          return
        }
        // touch totalHeight so MobX tracks it as a dependency (row height changes)
        void self.totalHeight
        const {
          mouseoverCanvas,
          hierarchy,
          rowHeight,
          hoveredTreeNode,
          height,
          lineZoneHeight = 0,
          scrollTop = 0,
          sources,
        } = self
        if (!mouseoverCanvas) {
          return
        }

        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const viewWidth = view.width
        const contentHeight = height - lineZoneHeight
        const ctx = resizeCanvas(mouseoverCanvas, viewWidth, contentHeight)
        if (!ctx) {
          return
        }

        ctx.clearRect(0, 0, viewWidth, contentHeight)

        if (hierarchy && hoveredTreeNode && sources) {
          ctx.save()
          ctx.translate(0, -scrollTop)

          ctx.fillStyle = 'rgba(255,165,0,0.2)'
          const descendantSet = new Set(hoveredTreeNode.descendantNames)
          for (let i = 0, l = sources.length; i < l; i++) {
            const source = sources[i]!
            if (descendantSet.has(source.name)) {
              const y = i * rowHeight
              ctx.fillRect(0, y, viewWidth, rowHeight)
            }
          }

          const { node } = hoveredTreeNode
          ctx.fillStyle = 'rgba(255,165,0,0.8)'
          ctx.beginPath()
          ctx.arc(node.y, node.x, 4, 0, 2 * Math.PI)
          ctx.fill()

          ctx.strokeStyle = 'rgba(255,140,0,1)'
          ctx.lineWidth = 1
          ctx.stroke()

          ctx.restore()
        }
      },
      { name: 'TreeHover' },
    ),
  )
}
