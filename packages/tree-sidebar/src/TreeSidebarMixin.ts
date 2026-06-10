import { cast, types } from '@jbrowse/mobx-state-tree'

import { applySubtreeFilter, buildTree } from './clusterUtils.ts'
import { maxNodeHeight } from './hierarchy.ts'

import type { HoveredTreeNode } from './types.ts'

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
    }))
    .actions(self => ({
      setLayout(layout: S[]) {
        // Clear the cached cluster tree whenever the set of sample names
        // changes (membership or order) — the tree was built from the prior
        // layout and is no longer valid.
        const namesChanged =
          !!self.clusterTree &&
          (self.layout.length !== layout.length ||
            self.layout.some(
              (source, idx) => source.name !== layout[idx]?.name,
            ))
        self.layout = layout
        if (namesChanged) {
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
