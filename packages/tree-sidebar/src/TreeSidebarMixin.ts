import { getConf, setConf } from '@jbrowse/core/configuration'
import { cast, types } from '@jbrowse/mobx-state-tree'

import { applySubtreeFilter, buildTree } from './clusterUtils.ts'
import { maxNodeHeight } from './hierarchy.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { TreeSidebarConfigModel } from './treeSidebarConfigSchemaFields.ts'
import type { HoveredTreeNode, RowSource } from './types.ts'

/**
 * The whole of what `TreeSidebarMixin` needs a composing display to be.
 * Exported because it is the mixin's contract and `TreeSidebarMixin.test.ts`
 * pins it: widen it and the `@ts-expect-error`s there go unused.
 */
export interface TreeSidebarHost {
  configuration: TreeSidebarConfigModel
}

// The mixin's own `self` is the model it declares, so it cannot see the
// `configuration` the concrete display supplies — every display composing this
// is a BaseDisplay, so it is really there. Same idiom, and the same reason, as
// `HeightModeMixin`'s `confNode`. Narrowed to the sibling field table rather
// than `AnyConfigurationModel`, which is what keeps the three slot names below
// checked; `ConfigModelForFields` has the why.
const confNode = (self: object) => self as TreeSidebarHost

/**
 * #stateModel TreeSidebarMixin
 * #category display
 * #crossCuttingMixin Row set with a dendrogram sidebar. `sources` (the display rows, named), the three `treeSidebarConfigSchemaFields` slots, plus the `run` callback naming its own clustering RPC. Brings `layout` / `clusterTree` / `clusterProvenance` / `treeAreaWidth` / `subtreeFilter`, the `showTree` / `showBranchLength` / `showRowLabels` getters and setters over those slots, the `runClustering` / `clusterRegion` declarative launch pair `setupRunClusteringAutorun` consumes, the `root` and `willClearTree` getters, and the tree-hover and canvas-ref volatiles the shared sidebar draws through
 * Adds a dendrogram sidebar to a display: stores the leaf layout, newick cluster
 * tree, sidebar width and subtree filter, plus the hover/canvas volatile state
 * used while drawing the tree.
 *
 * **The three toggles are declared here because this package reads them.**
 * `treeSidebarGeometry` reads `showTree`, `treeMenuItems` reads all three and
 * `setShowTree`, `computeClusterHierarchy` takes `showBranchLength` — so a
 * display composing this mixin and not supplying them would compile and then
 * fail at the first menu click. They were four hand-written `getConf` /
 * `setConf` copies, which is the same shape the config half was in before
 * `treeSidebarConfigSchemaFields`: that set had already drifted, three displays
 * spelling the labels toggle `showRowLabels` and the fourth
 * `showSidebarLabels`, so `"showRowLabels": false` on a multi-sample variant
 * track was dropped in silence. Slots and accessors now move together.
 */
export function TreeSidebarMixin<S extends RowSource = RowSource>() {
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
    .actions(self => {
      // The ONLY place `clusterTree` is assigned, because `clusterProvenance`
      // has to move with it in the same action — always. The failure that
      // guards against is not a missing caption but a *wrong* one: provenance
      // left standing from a previous run labels the new dendrogram with the
      // old run's locus, which is worse than saying nothing at all.
      //
      // A helper rather than four hand-written pairs because taking both
      // together is what makes "set the tree and keep the old provenance"
      // unspellable. It also puts each caller's intent in its argument list:
      // omitting `provenance` is how a tree that arrives as data (maf's `.nh`)
      // says it has no locus, rather than being a separate line to forget.
      function writeTree(tree?: string, provenance?: ClusterProvenance) {
        self.clusterTree = tree
        self.clusterProvenance = provenance
      }
      return {
        setLayout(layout: S[]) {
          const clearTree = self.willClearTree(layout)
          self.layout = layout
          if (clearTree) {
            writeTree(undefined)
          }
        },
        // Reset to no arrangement at all, which includes the subtree filter: the
        // user asked for the rows back as they came.
        //
        // The filter is otherwise **independent of the tree**. It is a set of
        // row names, and `filterRowsBySubtree` matches on `name` with no tree
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
          writeTree(undefined)
          self.subtreeFilter = undefined
        },
        // For a tree that arrives as data rather than from a run — maf's `.nh`
        // guide tree. It has no locus and no settings, so it passes no
        // provenance, which is how it drops the previous tree's.
        setClusterTree(tree?: string) {
          writeTree(tree)
        },
        setLayoutAndClusterTree(
          layout: S[],
          tree?: string,
          provenance?: ClusterProvenance,
        ) {
          self.layout = layout
          writeTree(tree, provenance)
        },
        setTreeAreaWidth(width: number) {
          self.treeAreaWidth = width
        },
        setSubtreeFilter(names?: string[]) {
          // normalize empty to undefined so the field has one stripped state
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
      }
    })
}
