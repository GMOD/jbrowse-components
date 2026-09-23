import { getConf } from '@jbrowse/core/configuration'
import { cast, types } from '@jbrowse/mobx-state-tree'

import { buildTree } from './clusterUtils.ts'
import {
  orderDropsTree,
  treeHeightViews,
  treeSidebarBase,
  treeViews,
} from './treeSidebarBase.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { ClusterRun } from './treeSidebarBase.ts'
import type { LayoutTreeSidebarConfigModel } from './treeSidebarConfigSchemaFields.ts'
import type { RowSource } from './types.ts'

/**
 * The whole of what `LayoutTreeSidebarMixin` needs a composing display to be.
 * Exported because it is the mixin's contract and its test pins it: widen it
 * and the `@ts-expect-error`s there go unused.
 */
export interface LayoutTreeSidebarHost {
  configuration: LayoutTreeSidebarConfigModel
}

const confNode = (self: object) => self as LayoutTreeSidebarHost

/**
 * #stateModel LayoutTreeSidebarMixin
 * #category display
 * #crossCuttingMixin The dendrogram sidebar with its arrangement in display state — `layout`, `clusterTree`, `clusterProvenance` and `subtreeFilter` — as the multi-row feature and MAF displays still keep it. The same arrangement API as `TreeSidebarMixin` over those props, until each display moves onto the `rows` config object
 *
 * The row axis's declared order is the `domain` slot, read as `rowDomain`
 * and applied under `layout`, which stays the runtime arrangement every drag,
 * dialog, clustering run and column sort writes.
 */
export function LayoutTreeSidebarMixin<S extends RowSource = RowSource>() {
  return treeSidebarBase()
    .props({
      layout: types.stripDefault(types.frozen<S[]>(), []),
      clusterTree: types.stripDefault(types.maybe(types.string), undefined),
      /**
       * #property
       * What `clusterTree` was computed from — the locus and the settings.
       * Set only for a tree this app computed; a supplied phylogeny (maf's
       * `.nh`) leaves it undefined.
       */
      clusterProvenance: types.stripDefault(
        types.maybe(types.frozen<ClusterProvenance>()),
        undefined,
      ),
      subtreeFilter: types.stripDefault(
        types.maybe(types.array(types.string)),
        undefined,
      ),
    })
    .views(self => ({
      /**
       * #getter
       * The row axis's declared order off the `domain` slot — the config seed
       * `orderRowsByDomain` places rows through, under whatever `layout` says.
       */
      get rowDomain(): string[] {
        const host = confNode(self)
        if (!('domain' in host.configuration)) {
          throw new Error(
            'LayoutTreeSidebarMixin: this display declares no `domain` slot (rowDomainConfigSchemaFields was not spread), so it owes a `rowDomain` getter of its own in a `.views` layer after the mixin',
          )
        }
        return getConf(host, 'domain')
      },
    }))
    .views(self => ({
      // `rowDomain` rotates a tree nothing has arranged under: no provenance,
      // so it was supplied rather than computed (maf's `.nh`), and no `layout`,
      // so the rows are the tree's own leaves. A run rotates its own tree in
      // the same action as the `layout` it writes; rotating one again here
      // would turn a restored session's dendrogram away from the rows saved
      // beside it, and `treeDescribesRows` would then draw nothing at all.
      get parsedTree() {
        const arranged = !!self.clusterProvenance || self.layout.length > 0
        return self.clusterTree
          ? buildTree(self.clusterTree, arranged ? [] : self.rowDomain)
          : undefined
      },
      /**
       * #getter
       * The cluster tree the rows are arranged by, as newick: a run's, or a
       * supplied phylogeny (maf's `.nh`).
       */
      get rowTree(): string | undefined {
        return self.clusterTree
      },
      /**
       * #getter
       * What `rowTree` was computed from, the locus and the settings; undefined
       * for a supplied tree.
       */
      get rowTreeProvenance(): ClusterProvenance | undefined {
        return self.clusterProvenance
      },
      /**
       * #getter
       * The row names a focus narrows the display to — a clade picked off the
       * tree or a legend group — or undefined while every row shows.
       */
      get rowFocus(): readonly string[] | undefined {
        return self.subtreeFilter
      },
      /**
       * #getter
       * Whether the rows have been arranged away from the order they arrived
       * in — what "Reset row order" is offered on.
       */
      get rowArrangementIsCustom(): boolean {
        return self.layout.length > 0
      },
      rowOrderWillDropTree(next: readonly { name: string }[]) {
        return orderDropsTree(
          self.clusterTree,
          self.layout.map(source => source.name),
          next,
        )
      },
    }))
    .views(self => treeViews(self))
    .views(self => treeHeightViews(self))
    .actions(self => {
      // The ONLY place `clusterTree` is assigned, because `clusterProvenance`
      // has to move with it in the same action — always: provenance left
      // standing from a previous run labels the new dendrogram with the old
      // run's locus, which is worse than saying nothing at all.
      function writeTree(tree?: string, provenance?: ClusterProvenance) {
        self.clusterTree = tree
        self.clusterProvenance = provenance
      }
      function orderRows(rows: S[], run?: ClusterRun) {
        if (run) {
          self.layout = rows
          writeTree(run.tree, run.provenance)
        } else {
          const dropTree = self.rowOrderWillDropTree(rows)
          self.layout = rows
          if (dropTree) {
            writeTree(undefined)
          }
        }
      }
      return {
        /**
         * #action
         * Arrange the rows in `rows`' order. A clustering run passes its
         * result, and the tree and its provenance land with the order; any
         * other reorder that moves a row drops the tree, which no longer
         * describes it.
         */
        setRowOrder(rows: S[], run?: ClusterRun) {
          orderRows(rows, run)
        },
        /**
         * #action
         * The arrangement dialog's submit: the rows in their new order, each
         * carrying the label and colours the reader set on it.
         */
        applyRowEdits(rows: S[]) {
          orderRows(rows)
        },
        /**
         * #action
         * Reset to no arrangement at all, focus included: the reader asked for
         * the rows back as they came.
         *
         * The focus is otherwise independent of the tree: a set of row names
         * `filterRowsBySubtree` matches with no tree involved, so a reorder or
         * a re-cluster leaves it valid and `setRowOrder` keeps it. What does
         * invalidate it is a change to what rows are called, which
         * `setPhasedMode` clears it for.
         */
        resetRowArrangement() {
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
        /**
         * #action
         * Narrow the display to `names`, or show every row again.
         */
        setRowFocus(names?: readonly string[]) {
          self.subtreeFilter = names?.length ? cast([...names]) : undefined
        },
      }
    })
}
