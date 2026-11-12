import { setConf } from '@jbrowse/core/configuration'
import { persistTrackConfigNow } from '@jbrowse/core/util'
import { ROW_ARRANGEMENT_MEMBERS } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import {
  liftRowColor,
  rowColorMembers,
  rowColorResetTarget,
  sameRowColor,
} from './color/rowColorChoice.ts'
import { ROW_COLOR_SCALE_ID, rowColorKeyValue } from './color/rowColorKey.ts'
import { rowColorFieldViews, rowColorViews } from './color/rowColorViews.ts'
import { labelEdits } from './rows/arrangeRows.ts'
import { baseRows, liveRows, present } from './rows/baseRows.ts'
import { focusRows } from './rows/focusRows.ts'
import { filteredRows } from './rows/narrowRows.ts'
import { rowNoticeViews } from './rows/rowNoticeViews.ts'
import {
  hierarchyViews,
  rowSidebarViews,
  listsInOrder,
  rowsContentHeightViews,
  treeSidebarAxisConfigViews,
  treeSidebarRowStages,
  treeSidebarRowsConfigViews,
} from './rows/treeSidebarRowViews.ts'
import { svgSidebarWidth } from './sidebar/svgSidebarWidth.ts'
import { treeSidebarRightEdge } from './sidebar/treeSidebarGeometry.ts'
import {
  getLeafNames,
  matchBandClades,
  maxNodeHeight,
} from './tree/hierarchy.ts'
import { buildTree } from './tree/newick.ts'
import { buildSpatialIndex } from './tree/spatialIndex.ts'

import type { ClusterProvenance } from './clustering/clusterProvenance.ts'
import type { RowColorEdits } from './color/rowColorChoice.ts'
import type { RowColorSetting } from './color/rowColors.ts'
import type { ArrangementMember } from './rows/baseRows.ts'
import type { RowSortSpec } from './rows/rowSort.ts'
import type { TreeSidebarConfigModel } from './rows/treeSidebarRowViews.ts'
import type { SvgSidebarProps } from './sidebar/svgSidebarWidth.ts'
import type { TreeSpatialIndex } from './tree/spatialIndex.ts'
import type { HoveredTreeNode, Row } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'
import type { SidebarBounds } from '@jbrowse/display-ui'

export type { TreeSidebarConfigModel } from './rows/treeSidebarRowViews.ts'

/**
 * The whole of what `TreeSidebarMixin` needs a composing display to be: the
 * `rows` object, its axis, colors and color channel, the resolved row
 * height, and the scroll a focus resets (`TrackHeightMixin`).
 */
export interface TreeSidebarHost {
  configuration: TreeSidebarConfigModel & { displayId: string }
  effectiveRowHeight: number
  setScrollTop(top: number): void
}

const host = <T extends object>(self: T) => self as T & TreeSidebarHost

// What "Reset row order" is offered on: the shown rows have a clear of their
// own, the chip's "Show all", and a reset still takes them with the rest.
const ORDER_MEMBERS = ROW_ARRANGEMENT_MEMBERS.filter(m => m !== 'kept')

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

/** Whether some rotation of `newick` lists `order`'s names in its order. */
function rotationLists(newick: string, order: readonly string[]) {
  return listsInOrder(getLeafNames(buildTree(newick, order)), order)
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
 * #crossCuttingMixin Row set with a dendrogram sidebar, its arrangement and its row colors the display's `rows` config object (`rows.colors` pinned on rows, `rows.color` mapped from an attribute), each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`arrangedRows`, `shownRows`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows`, and `guideTreeNewick` where its adapter has a tree, and overrides the hooks its rows need
 *
 * The rows are derived in stages, each a separate computed: the display's
 * `discoveredRows`, then `expandedRows` (`expandRows`: a variant display's
 * haplotypes), then `arrangedRows`, ordered by `rowOrder`, relabelled by
 * `rows.labels` and each with its resolved color as `rowColor`, then
 * `shownRows`, narrowed to the focus, then `stackedRows`, stacked
 * in the bands `rowBanding` names. The stages, the row colors, where
 * the rows start (`rowsTopOffset`) and the dendrogram positioned against them
 * (`hierarchy`) are written in `treeSidebarRowViews.ts`,
 * which a tables export installs on a model of its own beside its display's
 * row hooks, so it arranges and colors the rows as the view does.
 *
 * A row's color is `resolvedRowColors`: its `rows.colors` entry, else its
 * `rows.color` entry (the color `dealtValueColors` deals its field's value),
 * else the row's `color`, else the row palette's color by name where
 * `rowPaletteDeals`. The
 * sidebar draws it as a bar beside the row's label, and a display paints its
 * marks in it where `rowColorPaintsMarks`. Its key is `rowColorScales`, and a
 * click on an entry focuses that entry's rows (`focusLegendEntry`).
 *
 * Every arrangement write reaches the session at once rather than after the
 * track's 400 ms save, so a clustering run is one undo step and undoable the
 * moment its tree appears. "Reset row order" returns each member, and
 * `rows.color` where it sets a row a color, to what the config.json declares,
 * or what a track the session owns was added with, and never touches
 * `rows.field`.
 */
export function TreeSidebarMixin<S extends Row = Row>() {
  const base = types
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
       * set `{refName, pos}` to order the rows once by the value each row has
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
    .views(self => treeSidebarAxisConfigViews(host(self)))
    .views(() => ({
      /**
       * #getter
       * Overridable hook: whether the track lists its rows before any region
       * loads (a VCF's samples, a multi-wiggle's subtracks), so a `rows.kept`
       * name no row has is a typo worth naming. False by default, for rows
       * found per window.
       */
      get rowsListedUpFront(): boolean {
        return false
      },
      /**
       * #method
       * Overridable hook: whether a row named `name` exists only at some
       * loci even where the track lists its rows, so a `rows.kept` name
       * missing here is no typo: MAF's copy rows (`mm10~2`). False by
       * default.
       */
      rowFoundAtSomeLoci(_name: string): boolean {
        return false
      },
    }))
    .views(self => treeSidebarRowsConfigViews(host(self)))

  return treeSidebarRowStages<S>()(base)
    .views(() => ({
      /**
       * #getter
       * Overridable hook: what the sidebar says where the tree's leaves are
       * `finerRows`, which it hides.
       */
      get finerTreeHint(): { text: string; title: string } {
        return {
          text: 'Tree hidden — clustered on finer rows than these',
          title:
            'The tree names rows each of these stands for. Re-run clustering to cluster these rows. Click to dismiss.',
        }
      },
      /**
       * #getter
       * Overridable hook: what the SVG export draws in the sidebar left of the
       * track, or undefined, the default, for none. `SvgTreeSidebar` draws it
       * and `svgSidebarWidth` sizes the gutter from it.
       */
      get svgSidebar(): SvgSidebarProps | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook: the row fields that are display plumbing,
       * which the arrangement dialog never lists as a column.
       */
      get internalRowFields(): readonly string[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #method
       * Px the SVG export reserves left of the track for `svgSidebar`, measured
       * in the export's text.
       */
      svgSidebarWidth(text?: ExportTextStyle) {
        const { svgSidebar } = self
        return svgSidebar ? svgSidebarWidth(svgSidebar, text) : 0
      },
    }))
    .views(self => rowColorFieldViews(self))
    .views(self => rowColorViews(host(self)))
    .views(self => ({
      /**
       * #getter
       * Whether the arrangement differs from what the config declares — what
       * "Reset row order" is offered on.
       */
      get rowArrangementIsCustom(): boolean {
        const live = liveRows(host(self))
        const base = baseRows(host(self))
        return (
          self.rowColorIsCustom ||
          ORDER_MEMBERS.some(
            member =>
              !compareStructural(present(live[member]), present(base[member])),
          )
        )
      },
      /**
       * #getter
       * The tree a reorder rotates rather than drops, as newick: a supplied
       * `rows.tree`, one with no provenance, else the guide tree while
       * `guideTreeHonoursDomain`. A computed tree is never one, since its run
       * rotated it already.
       */
      get rotatableRowTree(): string | undefined {
        const tree = self.storedRowTree
        return tree
          ? self.rowTreeProvenance
            ? undefined
            : tree
          : self.guideTreeHonoursDomain
            ? self.guideTreeNewick
            : undefined
      },
    }))
    .views(self => ({
      /**
       * #method
       * Whether ordering the rows as `order` drops the tree: one a reorder
       * rotates drops only for an order no rotation of it lists, and any
       * other drops for any change.
       */
      orderDropsRowTree(order: readonly string[]) {
        const rotatable = self.rotatableRowTree
        return rotatable
          ? !rotationLists(rotatable, order)
          : orderDropsTree(self.rowTree, self.rowSort, order)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Whether the arrangement dialog's submit of `next` drops the tree: an
       * order that moves no row is not written, so it drops nothing.
       */
      rowOrderWillDropTree(next: readonly { name: string }[]) {
        return (
          !movesNoRow(next, self.arrangedRows) &&
          self.orderDropsRowTree(orderOver(self.rowSort, next))
        )
      },
      /**
       * #getter
       * Overridable hook: whether the declarative `runClustering` run may
       * start, two or more `shownRows` by default.
       */
      get autoClusterReady(): boolean {
        return self.shownRows.length > 1
      },
    }))
    .views(self => rowsContentHeightViews(host(self)))
    .views(self => hierarchyViews(self))
    .views(self => rowSidebarViews(host(self)))
    .views(self => ({
      /**
       * #getter
       * The box the sidebar covers, in display px: left of `right`, the
       * dendrogram's resize handle's right edge (0 with no tree drawn), and
       * from `rowsTopOffset` down, so a band stacked above the rows stays the
       * display's across its full width. The canvas runs under the sidebar,
       * so x maps to bp as anywhere else. Every pointer gate reads it through
       * `sidebarCovers`, and a drag over the rows stops at `right`.
       */
      get sidebarBounds(): SidebarBounds {
        return { right: treeSidebarRightEdge(self), top: self.rowsTopOffset }
      },
      /**
       * #getter
       * Fills `FetchMixin`'s hook: a declared `runClustering` run is due, so
       * the loading scrim and the export wait for the rows it orders. The run
       * clears the flag when it settles, failed or not.
       */
      get awaitingDependentData(): boolean {
        return !!self.runClustering && self.autoClusterReady
      },
      /**
       * #getter
       * The hit index the sidebar's subtree hover reads, built from
       * `hierarchy`.
       */
      get spatialIndex(): TreeSpatialIndex | undefined {
        const { hierarchy } = self
        return hierarchy && buildSpatialIndex(hierarchy)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The names of the rows a clustering run clusters, by band, so each band
       * clusters apart and the run writes one forest; undefined while fewer
       * than two bands stack.
       */
      get clusterPartition(): string[][] | undefined {
        const { rowBands, stackedRows } = self
        return rowBands.length > 1
          ? rowBands.map(({ start, end }) =>
              stackedRows.slice(start, end).map(row => row.name),
            )
          : undefined
      },
      /**
       * #getter
       * How many bands the tree draws no dendrogram for, because it holds no
       * clade whose leaves are that band's rows in order; 0 with no tree or no
       * bands.
       */
      get treelessBandCount(): number {
        const { root, rowBands } = self
        return root && rowBands.length
          ? matchBandClades(root, self.stackedRows, rowBands).filter(
              clade => !clade,
            ).length
          : 0
      },
    }))
    .views(self => rowNoticeViews<S>(host(self)))
    .views(self => ({
      /**
       * #getter
       * Whether the tree's leaves include rows a finer field draws
       * (`finerRows`), each standing in for a drawn row, as a tree clustered
       * per haplotype is in sample mode: it describes no drawn rows, and the
       * hint says why (`finerTreeHint`).
       */
      get treeOnFinerRows(): boolean {
        const tree = self.parsedTree
        const alias = self.rowAlias
        const drawn = new Set(self.expandedRows.map(row => row.name))
        return (
          !!tree &&
          !!alias &&
          getLeafNames(tree).some(leaf => {
            const onto = drawn.has(leaf) ? undefined : alias(leaf)
            return onto !== undefined && onto !== leaf && drawn.has(onto)
          })
        )
      },
      /**
       * #getter
       * Whether the tree has merge heights, so a dendrogram layout differs
       * from the cladogram; gates the "Show tree branch lengths" toggle.
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
        setConf(host(self), ['rows', 'axis', 'tree'], arg)
      },
      /**
       * #action
       */
      setShowBranchLength(arg: boolean) {
        setConf(host(self), ['rows', 'axis', 'branchLength'], arg)
      },
      /**
       * #action
       */
      setShowRowLabels(arg: boolean) {
        setConf(host(self), ['rows', 'axis', 'labels'], arg)
      },
      setTreeAreaWidth(width: number) {
        setConf(host(self), ['rows', 'axis', 'width'], width)
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
        setConf(host(self), ['rows', member], value)
      }
      function persist() {
        persistTrackConfigNow(self)
      }
      function writeTree(run?: ClusterRun) {
        write(
          'tree',
          run?.tree ? { newick: run.tree, provenance: run.provenance } : null,
        )
      }
      function writeOrder(rows: readonly { name: string }[], run?: ClusterRun) {
        const domain = orderOver(self.rowSort, rows)
        const dropTree = !run && self.orderDropsRowTree(domain)
        write('sort', domain)
        if (run) {
          writeTree(run)
        } else if (dropTree) {
          writeTree()
        }
      }
      function writeRowFilter(filter: unknown) {
        const rows: AnyConfigurationModel = host(self).configuration.rows
        if (Reflect.has(rows, 'filter')) {
          setConf(rows, 'filter', filter ?? [])
        }
      }
      function writeRowColor(setting: RowColorSetting) {
        setConf(host(self), ['rows', 'color'], rowColorMembers(setting))
      }
      return {
        /**
         * #action
         * Arrange the rows in `rows`' order, ahead of any name the current
         * order has that `rows` does not. A clustering run passes its
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
         * The chip's "Show all": clears `rows.kept` and returns `rows.filter`
         * to the config's, so a filter the config states shows through.
         */
        showAllRows() {
          write('kept', [])
          writeRowFilter(baseRows(host(self)).filter)
          persist()
        },
        /**
         * #action
         * The arrangement dialog's submit: the rows in their new order, each
         * with the label the reader left on it, and the colors the dialog
         * shows, `rows.colors` and `rows.color`, each written where it
         * differs from the config's. The labels go to `rows` by the rule
         * `labelEdits` states, and the order to `rows.sort` unless it moves
         * no row, so a submit that changes nothing writes nothing.
         */
        applyRowEdits(
          rows: readonly S[],
          { color, colors }: RowColorEdits = {},
        ) {
          if (
            color &&
            !sameRowColor(liftRowColor(color), self.rowColorChannel)
          ) {
            writeRowColor(liftRowColor(color))
          }
          if (
            colors &&
            !compareStructural(colors, Object.fromEntries(self.rowColorPins))
          ) {
            write('colors', { ...colors })
          }
          write(
            'labels',
            labelEdits({
              rows,
              shown: self.arrangedRows,
              adapter: self.expandedRows,
              labels: self.rowLabels,
              rowParent: row => self.rowParent(row),
            }),
          )
          if (!movesNoRow(rows, self.arrangedRows)) {
            writeOrder(rows)
          }
          persist()
        },
        /**
         * #action
         * Return every arrangement member — order, labels, colors, tree,
         * provenance, kept rows and `rows.filter` — to what the config declares, leaving
         * `rows.field`, and `rows.color` to `rowColorResetTarget`: the
         * config's for the choice, which stays. On another field than the
         * config's, the members naming rows clear instead, since the
         * config's name the old field's rows.
         */
        resetRowArrangement() {
          const base = baseRows(host(self))
          for (const member of ROW_ARRANGEMENT_MEMBERS) {
            write(member, base[member])
          }
          writeRowFilter(base.filter)
          const target = rowColorResetTarget(
            self.rowColorChannel,
            self.baseRowColorChannel,
            self.rowPaletteDeals,
          )
          if (target) {
            writeRowColor(target)
          }
          persist()
        },
        /**
         * #action
         * Color the rows by `choice`, as a menu picks it: '' for None,
         * `name` for Each row, or a field, starting from `rowColorFor`. The
         * pins stay under every choice. A pick of the current choice writes
         * nothing.
         */
        setRowColorChoice(choice: string) {
          if (choice !== self.rowColorChoice) {
            writeRowColor(self.rowColorFor(choice))
            persist()
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * `LegendHost`'s hook: a click on a row color key entry narrows the
       * rows to those it lists that `rows.filter` admits, so the focus names
       * no row the filter would hide. Every other scale's entries name
       * colors, not rows, and stay inert.
       */
      focusLegendEntry(scaleId: string, value: string) {
        const key = self.rowColorKeyInputs
        const names =
          scaleId === ROW_COLOR_SCALE_ID
            ? filteredRows(self.arrangedRows, self.rowFilter)
                .filter(row => rowColorKeyValue(row, key) === value)
                .map(row => row.name)
            : []
        if (names.length > 0) {
          focusRows(
            {
              setRowFocus: self.setRowFocus,
              setScrollTop: host(self).setScrollTop,
            },
            names,
          )
        }
      },
    }))
}
