import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun } from 'mobx'

import { TREE_STROKE, links, treeLinkSegments } from './hierarchy.ts'

import type { TreeDrawingModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// `getPreparedCanvas2D` (render-core) owns the backing-store size + dpr scaling
// + clear: sizing and drawing happen in the same reaction so a later
// React-driven resize can't wipe freshly drawn content, and the returned
// context is dpr-scaled so we draw in CSS pixels without blurring on Retina.

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
        const ctx = getPreparedCanvas2D(treeCanvas, treeAreaWidth, contentHeight)
        if (!ctx) {
          return
        }

        ctx.translate(0, -scrollTop)
        ctx.strokeStyle = TREE_STROKE
        ctx.lineWidth = 1

        ctx.beginPath()
        for (const { source, target } of links(hierarchy)) {
          for (const [[x0, y0], [x1, y1]] of treeLinkSegments(source, target)) {
            ctx.moveTo(x0, y0)
            ctx.lineTo(x1, y1)
          }
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
        const ctx = getPreparedCanvas2D(mouseoverCanvas, viewWidth, contentHeight)
        if (!ctx) {
          return
        }

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
