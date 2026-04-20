import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { links } from './hierarchy.ts'

import type { TreeDrawingModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
          scrollTop = 0,
        } = self

        if (!treeCanvas || !hierarchy) {
          return
        }

        const ctx = treeCanvas.getContext('2d')
        if (!ctx) {
          return
        }

        ctx.resetTransform()
        ctx.scale(2, 2)
        ctx.clearRect(0, 0, treeAreaWidth, height)

        ctx.translate(0, -scrollTop)
        ctx.strokeStyle = '#0008'
        ctx.lineWidth = 1

        ctx.beginPath()
        for (const link of links(hierarchy)) {
          const { source, target } = link
          const sy = source.x!
          const ty = target.x!
          const tx = target.y!
          const sx = source.y!

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
          scrollTop = 0,
          sources,
        } = self
        if (!mouseoverCanvas) {
          return
        }

        const ctx = mouseoverCanvas.getContext('2d')
        if (!ctx) {
          return
        }

        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const viewWidth = view.width

        ctx.clearRect(0, 0, viewWidth, height)

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
          ctx.arc(node.y!, node.x!, 4, 0, 2 * Math.PI)
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
