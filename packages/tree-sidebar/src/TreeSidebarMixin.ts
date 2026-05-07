import Flatbush from '@jbrowse/core/util/flatbush'
import { cast, types } from '@jbrowse/mobx-state-tree'

import { parseClusterTree } from './clusterUtils.ts'
import { descendants } from './hierarchy.ts'

import type { ClusterHierarchyNode, HoveredTreeNode } from './types.ts'

export function TreeSidebarMixin<
  S extends { name: string } = { name: string },
  H extends {
    hierarchy: ClusterHierarchyNode | undefined
    totalHeight?: number
  } = {
    hierarchy: ClusterHierarchyNode | undefined
    totalHeight?: number
  },
>() {
  return types
    .model({
      layout: types.optional(types.frozen<S[]>(), []),
      clusterTree: types.maybe(types.string),
      treeAreaWidth: types.optional(types.number, 80),
      subtreeFilter: types.maybe(types.array(types.string)),
    })
    .volatile(() => ({
      hoveredTreeNode: undefined as HoveredTreeNode | undefined,
      treeCanvas: null as HTMLCanvasElement | null,
      mouseoverCanvas: null as HTMLCanvasElement | null,
    }))
    .views(self => ({
      get root() {
        const { clusterTree } = self
        if (!clusterTree) {
          return undefined
        }
        return parseClusterTree(clusterTree, self.subtreeFilter)
      },
    }))
    .views(self => ({
      get spatialIndex() {
        const extended = self as typeof self & H
        const h = extended.hierarchy
        // touch treeAreaWidth and totalHeight so MobX tracks them as dependencies
        void self.treeAreaWidth
        void extended.totalHeight
        if (h) {
          const nodes = descendants(h).filter(node => node.children?.length)
          const index = new Flatbush(nodes.length)
          const hitRadius = 8
          for (const node of nodes) {
            const x = node.y
            const y = node.x
            index.add(
              x - hitRadius,
              y - hitRadius,
              x + hitRadius,
              y + hitRadius,
            )
          }
          index.finish()
          return { index, nodes }
        }
        return undefined
      },
    }))
    .actions(self => ({
      setLayout(layout: S[], clearTree = true) {
        const orderChanged =
          clearTree &&
          !!self.clusterTree &&
          self.layout.length === layout.length &&
          self.layout.some((source, idx) => source.name !== layout[idx]?.name)
        self.layout = layout
        if (orderChanged) {
          self.clusterTree = undefined
        }
      },
      clearLayout() {
        self.layout = []
        self.clusterTree = undefined
      },
      setClusterTree(tree?: string) {
        self.clusterTree = tree
      },
      setLayoutAndClusterTree(layout: S[], tree?: string) {
        self.layout = layout
        self.clusterTree = tree
      },
      setTreeAreaWidth(width: number) {
        self.treeAreaWidth = width
      },
      setSubtreeFilter(names?: string[]) {
        self.subtreeFilter = names ? cast(names) : undefined
      },
      setHoveredTreeNode(node?: HoveredTreeNode) {
        self.hoveredTreeNode = node
      },
      setTreeCanvasRef(ref: HTMLCanvasElement | null) {
        self.treeCanvas = ref
      },
      setMouseoverCanvasRef(ref: HTMLCanvasElement | null) {
        self.mouseoverCanvas = ref
      },
    }))
}
