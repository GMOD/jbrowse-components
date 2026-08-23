import { getContainingView, getPaletteHost } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { autorun } from 'mobx'

import {
  links,
  treeHoverColors,
  treeLinkSegments,
  treeStroke,
} from './hierarchy.ts'
import { rowRuns } from './rowRuns.ts'
import { treeContentHeight } from './treeSidebarGeometry.ts'

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
        const { treeCanvas, hierarchy, treeAreaWidth, scrollTop = 0 } = self

        if (!treeCanvas || !hierarchy) {
          return
        }

        const contentHeight = treeContentHeight(self)
        const ctx = getPreparedCanvas2D(
          treeCanvas,
          treeAreaWidth,
          contentHeight,
        )
        if (!ctx) {
          return
        }

        ctx.translate(0, -scrollTop)
        // `getPaletteHost(self).palette`, not a React theme: this is a model
        // autorun, and the read makes a theme switch repaint the tree
        ctx.strokeStyle = treeStroke(getPaletteHost(self).palette)
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
          effectiveRowHeight,
          hoveredTreeNode,
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
        const contentHeight = treeContentHeight(self)
        const ctx = getPreparedCanvas2D(
          mouseoverCanvas,
          viewWidth,
          contentHeight,
        )
        if (!ctx) {
          return
        }

        if (hierarchy && hoveredTreeNode && sources) {
          const colors = treeHoverColors(getPaletteHost(self).palette)
          ctx.save()
          ctx.translate(0, -scrollTop)

          ctx.fillStyle = colors.band
          // One rect per contiguous BLOCK of highlighted rows, not one per row:
          // this fill is translucent and the row height is fractional in
          // fit-to-height mode, so a rect per row blends twice over each shared
          // pixel and seams the highlight at every row boundary. See `rowRuns`.
          // A hovered subtree is contiguous whenever the tree is drawn at all
          // (`treeDescribesRows`), so this is normally a single rect.
          const descendantSet = new Set(hoveredTreeNode.descendantNames)
          const runs = rowRuns(sources, source =>
            descendantSet.has(source.name) ? true : undefined,
          )
          for (const { start, end } of runs) {
            ctx.fillRect(
              0,
              start * effectiveRowHeight,
              viewWidth,
              (end - start) * effectiveRowHeight,
            )
          }

          const { node } = hoveredTreeNode
          ctx.fillStyle = colors.node
          ctx.beginPath()
          ctx.arc(node.y, node.x, 4, 0, 2 * Math.PI)
          ctx.fill()

          ctx.strokeStyle = colors.nodeRing
          ctx.lineWidth = 1
          ctx.stroke()

          ctx.restore()
        }
      },
      { name: 'TreeHover' },
    ),
  )
}
