import { cast, types } from '@jbrowse/mobx-state-tree'

import { applySubtreeFilter, buildTree } from './clusterUtils.ts'
import { maxNodeHeight } from './hierarchy.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { HoveredTreeNode } from './types.ts'

/**
 * #stateModel TreeSidebarMixin
 * #category display
 * #crossCuttingMixin Row set with a dendrogram sidebar. `sources` (the display rows, named), plus the `run` callback naming its own clustering RPC. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `runClustering` / `clusterRegion` declarative launch pair `setupRunClusteringAutorun` consumes, the `root` and `willClearTree` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through
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
      /**
       * #property
       * What `clusterTree` was computed from — the locus and the settings.
       * Set only for a tree this app computed; a supplied phylogeny (maf's
       * `.nh`) leaves it undefined. Persisted with the tree so it survives a
       * session snapshot, which is the case that most needs it: a shared link
       * otherwise hands over a dendrogram with no way to learn its locus.
       */
      clusterProvenance: types.stripDefault(
        types.maybe(types.frozen<ClusterProvenance>()),
        undefined,
      ),
      treeAreaWidth: types.stripDefault(types.number, 80),
      subtreeFilter: types.stripDefault(
        types.maybe(types.array(types.string)),
        undefined,
      ),
      /**
       * #property
       * Transient declarative launch spec, the same idea as
       * `LinearGenomeView`'s `init`: a session or config sets this true and the
       * real clustering RPC runs once automatically, with no dialog, as soon as
       * the display reports itself ready. `setupRunClusteringAutorun` clears it
       * afterwards, so a saved session never re-triggers.
       *
       * Lives here rather than on each display because it is the trigger for a
       * run whose *output* — `clusterTree`, `clusterProvenance`, `layout` — is
       * this mixin's state. Three displays declared it identically, each with
       * its own wrapper module that existed to code-split the clustering code
       * and, along the way, hand-wrote the same six-member duck type of the
       * display. Splitting inside the `run` callback does the same job and
       * loads on a run rather than on every attach. What each run actually
       * *is* stays per display, in that callback.
       */
      runClustering: types.maybe(types.boolean),
      /**
       * #property
       * Where that run reads from, as a locstring (whitespace-separated for
       * several). Clustering is region-scoped, so running it over the visible
       * window feeds the estimator whatever happens to be on screen; naming the
       * locus instead lets a session cluster on the signal and then show it
       * against its context — otherwise a zoom the user has to perform in the
       * right order. Cleared with `runClustering`, since it is that flag's
       * argument and a locus left standing describes a run that is not coming.
       */
      clusterRegion: types.maybe(types.string),
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
      //
      // This covers the writes that go *through* `setLayout`. Rows can also move
      // without one — a display decorating `sources` downstream of `layout`, a
      // discovered row set growing as regions load — so the backstop is derived,
      // in `computeClusterHierarchy`, which declines to position a tree whose
      // leaves aren't the rows on screen. This getter stays because a warning
      // has to be answerable before the write, not after it.
      willClearTree(next: S[]) {
        return (
          !!self.clusterTree &&
          (self.layout.length !== next.length ||
            self.layout.some((source, idx) => source.name !== next[idx]?.name))
        )
      },
    }))
    .actions(self => ({
      // Provenance is written and cleared in the same action as the tree it
      // describes, never on its own. The failure it guards against is not a
      // missing caption but a *wrong* one: provenance left standing from a
      // previous run would label the new dendrogram with the old run's locus,
      // which is worse than saying nothing at all.
      setLayout(layout: S[]) {
        const clearTree = self.willClearTree(layout)
        self.layout = layout
        if (clearTree) {
          self.clusterTree = undefined
          self.clusterProvenance = undefined
        }
      },
      // Reset to no arrangement at all, which includes the subtree filter: the
      // user asked for the rows back as they came.
      //
      // The filter is otherwise **independent of the tree**. It is a set of row
      // names, and `filterRowsBySubtree` matches on `name` with no tree
      // involved, so a reorder or a re-cluster leaves it perfectly valid and
      // `setLayout` deliberately keeps it — dropping a focused clade on every
      // reorder would discard the user's focus, and for maf (where
      // `subtreeFilter` is a fetch argument) refetch every loaded region. What
      // does invalidate it is a change to what rows are *called*: the
      // multi-sample variant displays' rendering mode renames rows between
      // sample and haplotype ("HG001" ↔ "HG001 HP0"), and `setPhasedMode`
      // clears the filter for exactly that reason.
      clearLayout() {
        self.layout = []
        self.clusterTree = undefined
        self.clusterProvenance = undefined
        self.subtreeFilter = undefined
      },
      // For a tree that arrives as data rather than from a run — maf's `.nh`
      // guide tree. It has no locus and no settings, so this clears provenance
      // rather than leaving the previous tree's attached.
      setClusterTree(tree?: string) {
        self.clusterTree = tree
        self.clusterProvenance = undefined
      },
      setLayoutAndClusterTree(
        layout: S[],
        tree?: string,
        provenance?: ClusterProvenance,
      ) {
        self.layout = layout
        self.clusterTree = tree
        self.clusterProvenance = provenance
      },
      setTreeAreaWidth(width: number) {
        self.treeAreaWidth = width
      },
      setSubtreeFilter(names?: string[]) {
        // normalize empty to undefined so the field has a single stripped state
        self.subtreeFilter = names?.length ? cast(names) : undefined
      },
      setRunClustering(arg?: boolean) {
        self.runClustering = arg
      },
      setClusterRegion(arg?: string) {
        self.clusterRegion = arg
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
