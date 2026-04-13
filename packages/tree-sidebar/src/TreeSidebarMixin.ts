import { cast, types } from '@jbrowse/mobx-state-tree'

import { parseClusterTree } from './clusterUtils.ts'

import type { HoveredTreeNode } from './types.ts'

export function TreeSidebarMixin<S extends { name: string } = { name: string }>() {
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
        return parseClusterTree(clusterTree, self.subtreeFilter?.slice())
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
