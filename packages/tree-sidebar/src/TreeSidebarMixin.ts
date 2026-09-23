import { getConf, setConf } from '@jbrowse/core/configuration'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { isSessionWithBaseTrackConfig } from '@jbrowse/core/util/types'
import { ROW_ARRANGEMENT_MEMBERS } from '@jbrowse/display-kit/rowsConfigSchema'
import { getSnapshot, hasParent } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { buildTree } from './clusterUtils.ts'
import {
  orderDropsTree,
  treeHeightViews,
  treeSidebarBase,
  treeViews,
} from './treeSidebarBase.ts'

import type { ClusterProvenance } from './clusterProvenance.ts'
import type { ClusterRun } from './treeSidebarBase.ts'
import type { TreeSidebarConfigModel } from './treeSidebarConfigSchemaFields.ts'
import type { RowSource } from './types.ts'

/**
 * The whole of what `TreeSidebarMixin` needs a composing display to be: the
 * sidebar's toggle slots and the `rows` object.
 */
export interface TreeSidebarHost {
  configuration: TreeSidebarConfigModel & { displayId: string }
}

const confNode = (self: object) => self as TreeSidebarHost

type ArrangementMember = (typeof ROW_ARRANGEMENT_MEMBERS)[number]
type Arrangement = Partial<Record<ArrangementMember, unknown>>

// What "Reset row order" is offered on: the focus has a clear of its own, and
// a reset still takes it with the rest.
const ORDER_MEMBERS = ROW_ARRANGEMENT_MEMBERS.filter(m => m !== 'kept')

// An empty list or map is the member's default, which a stripped snapshot
// leaves out, so the two spellings compare as one.
function present(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? value : undefined
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length ? value : undefined
  }
  return value
}

/**
 * The config.json's entry for this display, hydrated, which a reset returns
 * to and "is this the reader's" compares against: empty for a track the
 * session owns, and in a session that keeps no base.
 */
export function baseDisplayConfig(self: object): Record<string, unknown> {
  if (!hasParent(self)) {
    return {}
  }
  const session = getSession(self)
  if (!isSessionWithBaseTrackConfig(session)) {
    return {}
  }
  const base = session.baseTrackConfig(
    getConf(getContainingTrack(self), 'trackId'),
  )
  const { displayId } = confNode(self).configuration
  const displays = base?.displays
  return (
    (Array.isArray(displays)
      ? (displays as Record<string, unknown>[]).find(
          d => d.displayId === displayId,
        )
      : undefined) ?? {}
  )
}

function baseArrangement(self: object): Arrangement {
  return (baseDisplayConfig(self).rows as Arrangement | undefined) ?? {}
}

function liveArrangement(self: object): Arrangement {
  return getSnapshot(confNode(self).configuration.rows) as Arrangement
}

/**
 * #stateModel TreeSidebarMixin
 * #category display
 * #crossCuttingMixin Row set with a dendrogram sidebar, its arrangement the display's `rows` config object: the order, the labels, the tree with its provenance and the focus, each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the `showTree` / `showBranchLength` / `showRowLabels` / `treeAreaWidth` getters and setters, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through (`rowDomain`, `rowLabels`, `rowTree`, `rowTreeProvenance`, `rowFocus`, `rowArrangementIsCustom`, `rowOrderWillDropTree`, `setRowOrder`, `setRowLabels`, `setRowFocus`, `resetRowArrangement`), the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. `applyRowEdits` stays the display's, since it writes colours the display keeps in its own object
 *
 * Every arrangement write reaches the session at once rather than after the
 * track's 400 ms save, so a clustering run is one undo step and undoable the
 * moment its tree appears. "Reset row order" returns each member to what the
 * config.json declares, or to nothing on a track the session owns, and never
 * touches `rows.field`.
 */
export function TreeSidebarMixin<S extends RowSource = RowSource>() {
  return treeSidebarBase()
    .views(self => ({
      /**
       * #getter
       * The row order, `rows.domain`: the rows it names lead, in its order,
       * and the rest keep the order they arrived in.
       */
      get rowDomain(): string[] {
        return getConf(confNode(self), ['rows', 'domain'])
      },
      /**
       * #getter
       * The labels drawn in place of row names, `rows.labels`, by name.
       */
      get rowLabels(): Readonly<Record<string, string>> {
        return getConf(confNode(self), ['rows', 'labels'])
      },
      /**
       * #getter
       * The cluster tree the rows are arranged by, `rows.tree`, as newick.
       */
      get rowTree(): string | undefined {
        return getConf(confNode(self), ['rows', 'tree'])
      },
      /**
       * #getter
       * What `rowTree` was computed from, the locus and the settings; undefined
       * for a tree that arrived as data.
       */
      get rowTreeProvenance(): ClusterProvenance | undefined {
        return getConf(confNode(self), ['rows', 'treeProvenance'])
      },
      /**
       * #getter
       * The row names a focus narrows the display to, `rows.kept` — a clade
       * picked off the tree or a key row's rows — or undefined while every
       * row shows.
       */
      get rowFocus(): readonly string[] | undefined {
        const kept: string[] = getConf(confNode(self), ['rows', 'kept'])
        return kept.length ? kept : undefined
      },
      /**
       * #getter
       * Overridable hook: whether the display keeps row styling of its own
       * beyond the arrangement that differs from the config, so a reset is
       * offered for it too. Nothing by default.
       */
      get rowStylingIsCustom(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the arrangement differs from what the config declares — what
       * "Reset row order" is offered on.
       */
      get rowArrangementIsCustom(): boolean {
        const live = liveArrangement(self)
        const base = baseArrangement(self)
        return (
          self.rowStylingIsCustom ||
          ORDER_MEMBERS.some(
            member =>
              !compareStructural(present(live[member]), present(base[member])),
          )
        )
      },
    }))
    .views(self => ({
      // A tree that arrived as data rotates towards the declared order at
      // parse; a run's tree was rotated by the run, in the same write as the
      // order it produced.
      get parsedTree() {
        return self.rowTree
          ? buildTree(
              self.rowTree,
              self.rowTreeProvenance ? [] : self.rowDomain,
            )
          : undefined
      },
      rowOrderWillDropTree(next: readonly { name: string }[]) {
        return orderDropsTree(self.rowTree, self.rowDomain, next)
      },
    }))
    .views(self => treeViews(self))
    .views(self => treeHeightViews(self))
    .actions(() => ({
      /**
       * #action
       * Overridable hook: return the row styling the display keeps of its
       * own to what the config declares, with the arrangement. Nothing by
       * default.
       */
      resetRowStyling() {},
    }))
    .actions(self => {
      function write(member: ArrangementMember, value: unknown) {
        setConf(confNode(self), ['rows', member], value)
      }
      function persist() {
        if (hasParent(self)) {
          getContainingTrack(self).persistConfigurationNow?.()
        }
      }
      function writeTree(run?: ClusterRun) {
        write('tree', run?.tree)
        write('treeProvenance', run?.provenance)
      }
      return {
        /**
         * #action
         * Arrange the rows in `rows`' order. A clustering run passes its
         * result, and the tree and its provenance land with the order; any
         * other reorder that moves a row drops the tree, which no longer
         * describes it.
         */
        setRowOrder(rows: readonly S[], run?: ClusterRun) {
          const dropTree = !run && self.rowOrderWillDropTree(rows)
          write(
            'domain',
            rows.map(row => row.name),
          )
          if (run) {
            writeTree(run)
          } else if (dropTree) {
            writeTree()
          }
          persist()
        },
        /**
         * #action
         * The labels drawn in place of row names, whole: a row the map does
         * not name shows the name it arrived with.
         */
        setRowLabels(labels: Readonly<Record<string, string>>) {
          write('labels', labels)
          persist()
        },
        /**
         * #action
         * Narrow the display to `names`, or show every row again.
         */
        setRowFocus(names?: readonly string[]) {
          write('kept', names?.length ? [...names] : [])
          persist()
        },
        /**
         * #action
         * Return every arrangement member — order, labels, tree, provenance
         * and focus — to what the config declares, leaving `rows.field`.
         */
        resetRowArrangement() {
          const base = baseArrangement(self)
          for (const member of ROW_ARRANGEMENT_MEMBERS) {
            write(member, base[member])
          }
          self.resetRowStyling()
          persist()
        },
      }
    })
}
