import { getContainingView } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from './components/treeTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface TreeDrawingModel {
  treeCanvas?: HTMLCanvasElement
  mouseoverCanvas?: HTMLCanvasElement
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  height: number
  rowHeight: number
  hoveredTreeNode?: HoveredTreeNode
  sources: { name: string; color?: string }[]
  numSources: number
}

export function setupTreeDrawingAutorun(self: TreeDrawingModel) {
  addDisposer(
    self,
    autorun(
      function treeDrawAutorun() {
        if (!isAlive(self)) {
          return
        }
        const { treeCanvas, hierarchy, treeAreaWidth, height } = self

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

        ctx.strokeStyle = '#0008'
        ctx.lineWidth = 1

        ctx.beginPath()
        for (const link of hierarchy.links()) {
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
        if (!isAlive(self)) {
          return
        }
        const { mouseoverCanvas, hierarchy, rowHeight, hoveredTreeNode, height, sources } = self
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
          ctx.fillStyle = 'rgba(255,165,0,0.2)'
          const descendantSet = new Set(hoveredTreeNode.descendantNames)
          for (let i = 0, l = sources.length; i < l; i++) {
            const source = sources[i]!
            if (descendantSet.has(source.name)) {
              const y = (i + 0.5) * rowHeight
              ctx.fillRect(0, y - rowHeight / 2, viewWidth, rowHeight)
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
        }
      },
      { name: 'TreeHover' },
    ),
  )
}
