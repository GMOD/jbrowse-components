import { cast, types } from '@jbrowse/mobx-state-tree'

import { applySubtreeFilter, buildTree } from './clusterUtils.ts'
import { maxNodeHeight } from './hierarchy.ts'

import type { HoveredTreeNode } from './types.ts'

/**
 * #stateModel TreeSidebarMixin
 * Adds a dendrogram sidebar to a display: stores the leaf layout, newick cluster
 * tree, sidebar width and subtree filter, plus the hover/canvas volatile state
 * used while drawing the tree.
 */
export function TreeSidebarMixin<
  S extends { name: string } = { name: string },
>() {
  return types
    .model({
      layout: types.stripDefault(types.frozen<S[]>(), []),
      clusterTree: types.stripDefault(types.maybe(types.string), undefined),
      treeAreaWidth: types.stripDefault(types.number, 80),
      subtreeFilter: types.stripDefault(
        types.maybe(types.array(types.string)),
        undefined,
      ),
    })
    .volatile(() => ({
      hoveredTreeNode: undefined as HoveredTreeNode | undefined,
      treeCanvas: null as HTMLCanvasElement | null,
      mouseoverCanvas: null as HTMLCanvasElement | null,
    }))
    .views(self => ({
      get parsedTree() {
        return self.clusterTree ? buildTree(self.clusterTree) : undefined
      },
    }))
    .views(self => ({
      get root() {
        return self.parsedTree
          ? applySubtreeFilter(self.parsedTree, self.subtreeFilter)
          : undefined
      },
    }))
    .views(self => ({
      // True when the tree carries cluster merge heights, i.e. a branch-length
      // (dendrogram) layout would actually differ from the cladogram. Gates the
      // "Tree branch lengths" toggle so it isn't a no-op on a height-less tree.
      get treeHasBranchLengths() {
        return !!self.root && maxNodeHeight(self.root) > 0
      },

      // True when persisting `next` would invalidate the cluster tree: the tree
      // was built from the current `layout`, so any membership/order change
      // (with a tree loaded) makes it stale. Single source of truth shared by
      // `setLayout` and the color dialog's pre-submit warning.
      willClearTree(next: S[]) {
        return (
          !!self.clusterTree &&
          (self.layout.length !== next.length ||
            self.layout.some((source, idx) => source.name !== next[idx]?.name))
        )
      },
    }))
    .actions(self => ({
      setLayout(layout: S[]) {
        const clearTree = self.willClearTree(layout)
        self.layout = layout
        if (clearTree) {
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
        // normalize empty to undefined so the field has a single stripped state
        self.subtreeFilter = names?.length ? cast(names) : undefined
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
