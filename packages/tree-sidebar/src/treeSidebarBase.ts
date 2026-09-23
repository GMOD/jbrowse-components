import { getConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { applySubtreeFilter } from './clusterUtils.ts'
import { maxNodeHeight } from './hierarchy.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { HierarchyNode } from './hierarchy.ts'
import type { RowSortSpec } from './rowSortAutorun.ts'
import type { TreeSidebarToggleConfigModel } from './treeSidebarConfigSchemaFields.ts'
import type { ClusterNodeData, HoveredTreeNode } from './types.ts'

/** The slots the sidebar's own toggles read, on every host. */
export interface TreeSidebarToggleHost {
  configuration: TreeSidebarToggleConfigModel
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies. Narrowed to the sidebar's
// field table rather than `AnyConfigurationModel`, which is what keeps the
// slot names below checked; `ConfigModelForFields` has the why.
const confNode = (self: object) => self as TreeSidebarToggleHost

/**
 * The half of the sidebar that is the same whichever store holds the
 * arrangement: the launch specs, the hover and canvas volatiles, and the
 * toggles this package's own code reads. `TreeSidebarMixin` and
 * `LayoutTreeSidebarMixin` each put an arrangement over it.
 */
export function treeSidebarBase() {
  return types
    .model({
      /**
       * #property
       * Transient declarative launch spec, the same idea as
       * `LinearGenomeView`'s `init`: a session or config sets this true and the
       * real clustering RPC runs once automatically, with no dialog, as soon as
       * the display reports itself ready. `setupRunClusteringAutorun` clears it
       * afterwards, so a saved session never re-triggers.
       */
      runClustering: types.maybe(types.boolean),
      /**
       * #property
       * Where that run reads from, as a locstring (whitespace-separated for
       * several). Clustering is region-scoped, so naming the locus lets a
       * session cluster on the signal and then show it against its context.
       * Cleared with `runClustering`, since it is that flag's argument.
       */
      clusterRegion: types.maybe(types.string),
      /**
       * #property
       * Transient declarative launch spec, the same idea as `runClustering`:
       * set `{refName, pos}` to order the rows once by the value each carries
       * at that genomic column — the session-expressible form of the
       * right-click "Sort rows by ... here". `setupRowSortAutorun` applies it
       * once the region containing it has loaded and then clears it, so the
       * resulting order persists but a saved session never re-sorts.
       */
      // #region frozenProp
      sortRowsBy: types.maybe(types.frozen<RowSortSpec>()),
      // #endregion
    })
    .volatile(() => ({
      hoveredTreeNode: undefined as HoveredTreeNode | undefined,
      treeCanvas: null as HTMLCanvasElement | null,
      mouseoverCanvas: null as HTMLCanvasElement | null,
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the dendrogram sidebar is drawn.
       */
      get showTree(): boolean {
        return getConf(confNode(self), 'showTree')
      },
      /**
       * #getter
       * Whether tree nodes are positioned by branch length (dendrogram) or
       * evenly by topology (cladogram).
       */
      get showBranchLength(): boolean {
        return getConf(confNode(self), 'showBranchLength')
      },
      /**
       * #getter
       * Whether each row's name is drawn over the left of the plot.
       */
      get showRowLabels(): boolean {
        return getConf(confNode(self), 'showRowLabels')
      },
      /**
       * #getter
       * Width in px of the sidebar the dendrogram draws in. On the config
       * rather than the display snapshot for the same reason `height` is: the
       * config node outlives the display instance, so a dragged width survives
       * unticking and reticking the track.
       */
      get treeAreaWidth(): number {
        return getConf(confNode(self), 'treeAreaWidth')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowTree(arg: boolean) {
        setConf(confNode(self), 'showTree', arg)
      },
      /**
       * #action
       */
      setShowBranchLength(arg: boolean) {
        setConf(confNode(self), 'showBranchLength', arg)
      },
      /**
       * #action
       */
      setShowRowLabels(arg: boolean) {
        setConf(confNode(self), 'showRowLabels', arg)
      },
      setTreeAreaWidth(width: number) {
        setConf(confNode(self), 'treeAreaWidth', width)
      },
      setRunClustering(arg?: boolean) {
        self.runClustering = arg
      },
      setClusterRegion(arg?: string) {
        self.clusterRegion = arg
      },
      /**
       * #action
       * Trigger (or clear) a one-shot declarative row sort; consumed and
       * reset by `setupRowSortAutorun`.
       */
      setSortRowsBy(arg?: RowSortSpec) {
        self.sortRowsBy = arg
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

/** What the tree-derived views read off either arrangement. */
export interface ArrangedTreeHost {
  parsedTree: HierarchyNode<ClusterNodeData> | undefined
  rowFocus: readonly string[] | undefined
}

/**
 * The views over a parsed tree that both arrangements share: the focused
 * root, and whether its heights make a dendrogram differ from a cladogram.
 */
export function treeViews(self: ArrangedTreeHost) {
  return {
    get root() {
      return self.parsedTree
        ? applySubtreeFilter(self.parsedTree, self.rowFocus)
        : undefined
    },
  }
}

export function treeHeightViews(self: {
  root: HierarchyNode<ClusterNodeData> | undefined
}) {
  return {
    // True when the tree carries cluster merge heights, i.e. a branch-length
    // (dendrogram) layout would actually differ from the cladogram. Gates the
    // "Tree branch lengths" toggle so it isn't a no-op on a height-less tree.
    get treeHasBranchLengths() {
      return !!self.root && maxNodeHeight(self.root) > 0
    },
  }
}

/** A clustering run's result, landed beside the order it produced. */
export interface ClusterRun {
  tree?: string
  provenance?: ClusterProvenance
}

/**
 * True when ordering the rows as `next` would drop the cluster tree: the tree
 * describes the current order, so any membership or order change makes it
 * stale. Shared by `setRowOrder` and the color dialog's pre-submit warning,
 * which has to be answerable before the write.
 */
export function orderDropsTree(
  tree: string | undefined,
  current: readonly string[],
  next: readonly string[],
) {
  return (
    !!tree &&
    (current.length !== next.length ||
      current.some((name, idx) => name !== next[idx]))
  )
}
