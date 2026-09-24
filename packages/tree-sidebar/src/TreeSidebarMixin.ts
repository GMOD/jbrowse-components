import { getConf, setConf } from '@jbrowse/core/configuration'
import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { getContainingTrack, getSession } from '@jbrowse/core/util'
import { isSessionWithBaseTrackConfig } from '@jbrowse/core/util/types'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { ROW_ARRANGEMENT_MEMBERS } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { getSnapshot, hasParent, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { arrangeRows, orderRowsByDomain } from './arrangeRows.ts'
import { applySubtreeFilter, buildTree, keptRows } from './clusterUtils.ts'
import { maxNodeHeight } from './hierarchy.ts'
import {
  materializedRowColors,
  rowColorScale,
  rowFieldValue,
} from './rowColorScale.ts'
import { rowEdits } from './rowEdits.ts'

import type {
  IdentityChannel,
  RowAlias,
  UnlistedRowsSort,
} from './arrangeRows.ts'
import type { ClusterProvenance } from './clusterProvenance.ts'
import type { RowColorDeal } from './rowColorScale.ts'
import type { RowSortSpec } from './rowSortAutorun.ts'
import type { TreeSidebarConfigModel } from './treeSidebarConfigSchemaFields.ts'
import type { HoveredTreeNode, RowSource } from './types.ts'

/**
 * The whole of what `TreeSidebarMixin` needs a composing display to be: the
 * sidebar's toggle slots, the `rows` object and the `rowColor` object.
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
 * The base's entry for this display, hydrated, which a reset returns to and
 * "is this the reader's" compares against: the config.json's, or the one a
 * track the session owns was added with; empty in a session that keeps no
 * base.
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

/** The `rowColor` object as read: its field, scale and entries. */
export interface RowColorSetting {
  field: string
  scale: 'none' | 'categorical' | undefined
  domain: readonly string[]
  range: readonly string[]
}

/** The `rowColor` object as a config writes it, a string lifted to its field. */
export type RowColorSnapshot = Partial<RowColorSetting>

function liftRowColor(value: unknown): RowColorSnapshot {
  return typeof value === 'string' ? { field: value } : (value ?? {})
}

function paintsNamePairs({ field, scale }: RowColorSnapshot) {
  return (field || 'name') === 'name' && scale !== 'none'
}

// The colours a `rowColor` object sets row by row: its pairs while it paints
// by `name`, none while it paints by an attribute.
function namePairs(color: RowColorSnapshot): Record<string, string> {
  return paintsNamePairs(color)
    ? Object.fromEntries(
        pairedColorsOf({
          domain: color.domain ?? [],
          range: color.range ?? [],
        }),
      )
    : {}
}

/**
 * The order a reorder writes: the rows it named lead, and the names the
 * current order carries beyond them follow in their current order, so a
 * declared row no loaded region holds yet keeps its place behind the rows on
 * screen.
 */
export function orderOver(
  current: readonly string[],
  rows: readonly { name: string }[],
): string[] {
  const named = rows.map(row => row.name)
  const shown = new Set(named)
  return [...named, ...current.filter(name => !shown.has(name))]
}

/**
 * True when ordering the rows as `next` would drop the cluster tree: the tree
 * describes the current order, so any membership or order change makes it
 * stale.
 */
function orderDropsTree(
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

/**
 * Whether the dialog's rows keep the order they have among the current rows,
 * so a row a region added while the dialog was open reads as no move.
 */
function movesNoRow(
  dialog: readonly { name: string }[],
  current: readonly { name: string }[],
) {
  const named = new Set(dialog.map(row => row.name))
  const among = current.filter(row => named.has(row.name))
  return (
    among.length === dialog.length &&
    among.every((row, i) => row.name === dialog[i]!.name)
  )
}

/** A clustering run's result, landed beside the order it produced. */
export interface ClusterRun {
  tree?: string
  provenance?: ClusterProvenance
}

/**
 * #stateModel TreeSidebarMixin
 * #category display
 * #crossCuttingMixin Row set with a dendrogram sidebar, its arrangement the display's `rows` config object and its row colours the `rowColor` object, each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`editableSources`, `clusterableSources`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows` and overrides the hooks its rows need
 *
 * The rows are derived in stages, each a computed of its own: the display's
 * `discoveredRows`, then `expandedRows` (`expandRows`: a variant display's
 * haplotypes), then `editableSources`, ordered by `rowOrder`, relabelled by
 * `rows.labels` and tinted by the `rowColor` pairs on the `identityChannel`,
 * then `clusterableSources`, narrowed to the focus. The row palette is
 * `rowColorScale`, dealt by `rowColorDeal` once per change to the rows, and
 * each display paints it, with its bands, over those.
 *
 * Every arrangement write reaches the session at once rather than after the
 * track's 400 ms save, so a clustering run is one undo step and undoable the
 * moment its tree appears. "Reset row order" returns each member, and
 * `rowColor` where it sets a row a colour, to what the config.json declares,
 * or what a track the session owns was added with, and never touches
 * `rows.field`.
 */
export function TreeSidebarMixin<S extends RowSource = RowSource>() {
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
      /**
       * #getter
       * The row order, `rows.domain`: the rows it names lead, in its order,
       * and the rest follow as `unlistedRowsSort` says.
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
       * The `rowColor` object: the row attribute whose values take colours,
       * `name` where it names none, the scale, and the values given a colour
       * of their own.
       */
      get rowColorSetting(): RowColorSetting {
        return {
          field: getConf(confNode(self), ['rowColor', 'field']) || 'name',
          scale: getConf(confNode(self), ['rowColor', 'scale']),
          domain: getConf(confNode(self), ['rowColor', 'domain']),
          range: getConf(confNode(self), ['rowColor', 'range']),
        }
      },
      /**
       * #getter
       * The `rowColor` object this display's base declares, as written, which
       * a reset returns to and "is this the reader's" compares against.
       */
      get baseRowColor(): RowColorSnapshot {
        return liftRowColor(baseDisplayConfig(self).rowColor)
      },
      /**
       * #getter
       * The `rows.domain` this display's base declares: the base arrangement
       * a row palette deals over, so no reorder recolours a row.
       */
      get baseRowDomain(): readonly string[] {
        const base = (baseDisplayConfig(self).rows ?? {}) as {
          domain?: string[]
        }
        return base.domain ?? []
      },
      /**
       * #getter
       * Overridable hook, which every display overrides: the rows as the data
       * reports them, before any arrangement. A getter, and a stable-identity
       * one wherever the rows come off region payloads, so a refetch of the
       * same rows re-derives nothing.
       */
      get discoveredRows(): S[] {
        return []
      },
      /**
       * #getter
       * Overridable hook: the name a row also answers to, for a display whose
       * rows stand for something named by another name (a variant display's
       * haplotype rows, each answering to its sample). An order, a label, a
       * tint and a focus written against the alias reach every row answering
       * to it. None by default.
       */
      get rowAlias(): RowAlias | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook: the row channel a `rowColor` entry paints, `color`
       * by default.
       */
      get identityChannel(): IdentityChannel {
        return 'color'
      },
      /**
       * #getter
       * Overridable hook: where the rows `rowOrder` does not list go, in the
       * order they arrived by default.
       */
      get unlistedRowsSort(): UnlistedRowsSort {
        return 'source'
      },
      /**
       * #method
       * Overridable hook: the discovered rows as the rows drawn, the rows
       * themselves by default; a variant display's phased mode expands each
       * sample to its haplotypes.
       */
      expandRows(rows: S[]): S[] {
        return rows
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: the names the rows are placed by, `rows.domain` by
       * default; MAF leads with a drawn tree's leaves.
       */
      get rowOrder(): readonly string[] {
        return self.rowDomain
      },
      /**
       * #getter
       * The colour a reader set on each named row: the `rowColor` pairs while
       * it paints by `name`, and none while it paints by another field.
       */
      get rowColors(): ReadonlyMap<string, string> {
        const setting = self.rowColorSetting
        return paintsNamePairs(setting) ? pairedColorsOf(setting) : new Map()
      },
      /**
       * #getter
       * Whether `rowColor` sets a row a colour the config does not, so "Reset
       * row order" is offered for a recolour too. A colour by attribute sets
       * none row by row, so picking one is not a custom arrangement.
       */
      get rowStylingIsCustom(): boolean {
        return !compareStructural(
          namePairs(self.rowColorSetting),
          namePairs(self.baseRowColor),
        )
      },
      /**
       * #getter
       * `discoveredRows` through `expandRows`: the rows at the granularity
       * drawn, before any arrangement.
       */
      get expandedRows(): S[] {
        return self.expandRows(self.discoveredRows)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: what the row palette deals, or undefined to deal
       * none. By default the values of `rowColor.field` over the rows in the
       * base arrangement, the values `rowColor.domain` lists taking its
       * `range`, and every other value the next palette colour, so no
       * reorder, focus or relabel recolours a row.
       */
      get rowColorDeal(): RowColorDeal<S> | undefined {
        const { field, scale, domain, range } = self.rowColorSetting
        if (scale === 'none') {
          return undefined
        }
        const valueOf = (row: S) =>
          field === 'name' ? row.name : rowFieldValue(row, field)
        return {
          order: [
            ...domain,
            ...orderRowsByDomain(
              self.expandedRows,
              self.baseRowDomain,
              self.rowAlias,
            ).map(valueOf),
          ],
          valueOf,
          domain,
          range,
          palette: categoricalPalette,
        }
      },
    }))
    .views(self => {
      const scale = stableIdentityComputed(() =>
        rowColorScale(self.expandedRows, self.rowColorDeal),
      )
      return {
        /**
         * #getter
         * The colour the row palette deals each row, by name, once per change
         * to the rows or the deal. Each display paints it where its palette
         * lands, with its own precedence over a row's own colour.
         */
        get rowColorScale(): ReadonlyMap<string, string> {
          return scale.get()
        },
      }
    })
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
      /**
       * #getter
       * The rows in the reader's arrangement, with no focus, palette or band:
       * the list the arrangement dialog edits, so a submit writes back only
       * what the reader chose. `expandedRows` itself while nothing is
       * arranged.
       */
      get editableSources(): S[] {
        return arrangeRows(
          self.expandedRows,
          {
            domain: self.rowOrder,
            labels: self.rowLabels,
            rowColors: self.rowColors,
          },
          self,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `editableSources` narrowed to the focus: the rows a clustering run
       * clusters, and deliberately not the display's decorated `sources`,
       * whose palette and band a run has no business writing back.
       */
      get clusterableSources(): S[] {
        return keptRows(self.editableSources, self.rowFocus, self.rowAlias)
      },
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
      /**
       * #method
       * Whether the arrangement dialog's submit of `next` drops the tree: an
       * order that moves no row is not written, so it drops nothing.
       */
      rowOrderWillDropTree(next: readonly { name: string }[]) {
        return (
          !movesNoRow(next, self.editableSources) &&
          orderDropsTree(
            self.rowTree,
            self.rowDomain,
            orderOver(self.rowDomain, next),
          )
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The parsed tree narrowed to the focus.
       */
      get root() {
        return self.parsedTree
          ? applySubtreeFilter(self.parsedTree, self.rowFocus)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the tree carries merge heights, so a dendrogram layout differs
       * from the cladogram; gates the "Tree branch lengths" toggle.
       */
      get treeHasBranchLengths() {
        return !!self.root && maxNodeHeight(self.root) > 0
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
    .actions(self => {
      function write(member: ArrangementMember, value: unknown) {
        setConf(confNode(self), ['rows', member], value)
      }
      function writeRowColor(pairs: RowColorSnapshot) {
        setConf(
          confNode(self),
          ['rowColor', 'domain'],
          [...(pairs.domain ?? [])],
        )
        setConf(confNode(self), ['rowColor', 'range'], [...(pairs.range ?? [])])
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
      function writeOrder(rows: readonly { name: string }[], run?: ClusterRun) {
        const domain = orderOver(self.rowDomain, rows)
        const dropTree =
          !run && orderDropsTree(self.rowTree, self.rowDomain, domain)
        write('domain', domain)
        if (run) {
          writeTree(run)
        } else if (dropTree) {
          writeTree()
        }
      }
      function resetRowStyling() {
        if (self.rowStylingIsCustom) {
          setConf(confNode(self), 'rowColor', self.baseRowColor)
        }
      }
      return {
        /**
         * #action
         * Arrange the rows in `rows`' order, ahead of any name the current
         * order carries that `rows` does not. A clustering run passes its
         * result, and the tree and its provenance land with the order; any
         * other reorder that moves a row drops the tree, which no longer
         * describes it.
         */
        setRowOrder(rows: readonly { name: string }[], run?: ClusterRun) {
          writeOrder(rows, run)
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
         * The arrangement dialog's submit: the rows in their new order, each
         * carrying the label and colour the reader left on it. The labels go
         * to `rows` and the colours to the `rowColor` pairs, by the rule
         * `rowEdits` states, and the order to `rows.domain` unless it moves no
         * row, so a submit that changes nothing writes nothing. Where
         * `rowColor` paints by another field, a recolour first makes every
         * row's current colour a `name` pair and the field `name`.
         */
        applyRowEdits(rows: readonly S[]) {
          const setting = self.rowColorSetting
          const byName = paintsNamePairs(setting)
          const colors = byName
            ? self.rowColors
            : materializedRowColors(self.rowColorScale)
          const { labels, rowColor } = rowEdits({
            rows,
            shown: self.editableSources,
            adapter: self.expandedRows,
            labels: self.rowLabels,
            colors,
            baseOrder: self.baseRowColor.domain ?? [],
            identityChannel: self.identityChannel,
            rowAlias: self.rowAlias,
          })
          const moved = !movesNoRow(rows, self.editableSources)
          const recoloured = !compareStructural(
            Object.fromEntries(pairedColorsOf(rowColor)),
            Object.fromEntries(colors),
          )
          if (recoloured && byName) {
            writeRowColor(rowColor)
          } else if (recoloured) {
            setConf(confNode(self), 'rowColor', { field: 'name', ...rowColor })
          }
          write('labels', labels)
          if (moved) {
            writeOrder(rows)
          }
          persist()
        },
        /**
         * #action
         * Return the `rowColor` object, whole, to what the config declares
         * where it sets a row a colour the config does not, so a colour by
         * attribute stays and one a recolour turned into pairs comes back.
         */
        resetRowStyling() {
          resetRowStyling()
        },
        /**
         * #action
         * Return every arrangement member — order, labels, tree, provenance
         * and focus — and the `rowColor` object to what the config declares,
         * leaving `rows.field`.
         */
        resetRowArrangement() {
          const base = baseArrangement(self)
          for (const member of ROW_ARRANGEMENT_MEMBERS) {
            write(member, base[member])
          }
          resetRowStyling()
          persist()
        },
      }
    })
}
