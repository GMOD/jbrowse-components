import {
  canonicalSpelling,
  getConf,
  getConfigurationSchemaMetadata,
  isKeyedWrites,
  keyedBase,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { capitalizeFirst, persistTrackConfigNow } from '@jbrowse/core/util'
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'
import {
  predicatesOf,
  unreadFieldNotice,
} from '@jbrowse/core/util/fieldPredicate'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { ROW_ARRANGEMENT_MEMBERS } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { arrangeRows, bandRows, rowAliasOver } from './arrangeRows.ts'
import {
  treeOfLeaves,
  buildTree,
  computeClusterHierarchy,
  getLeafNames,
  keptRows,
  matchBandClades,
} from './clusterUtils.ts'
import { focusRows } from './focusRows.ts'
import { maxNodeHeight } from './hierarchy.ts'
import {
  filteredRows,
  listedNames,
  narrowRows,
  narrows,
  rowFilterText,
  unmatchedKeptNames,
  unreadRowFields,
} from './narrowRows.ts'
import {
  liftRowColor,
  pinnedColorsOf,
  rowColorChoiceOf,
  rowColorMembers,
  rowColorResetTarget,
  rowColorSettingOf,
  sameRowColor,
  startingRowColor,
} from './rowColorChoice.ts'
import {
  ROW_COLOR_SCALE_ID,
  dealValueColors,
  resolveRowColors,
  rowColorKeyEntries,
  rowColorKeyValue,
  rowFieldValue,
  withPinnedColors,
  withRowColors,
} from './rowColorScale.ts'
import { labelEdits } from './rowEdits.ts'
import { IDENTITY_FIELDS, extraColumns } from './sourcesGridUtils.ts'
import { buildSpatialIndex } from './spatialIndex.ts'
import { svgSidebarWidth } from './svgSidebarWidth.ts'
import { SIDEBAR_HINT_LINE_PX } from './treeSidebarGeometry.ts'

import type {
  RowAlias,
  RowBand,
  RowBanding,
  RowParent,
  UnlistedRowsSort,
} from './arrangeRows.ts'
import type { ClusterProvenance } from './clusterProvenance.ts'
import type { RowNarrowing } from './narrowRows.ts'
import type { TreeSidebarConfigModel } from './rowAxisConfigSchema.ts'
import type { RowColorEdits, RowColorSnapshot } from './rowColorChoice.ts'
import type { RowColorKeyInputs, RowColorSetting } from './rowColorScale.ts'
import type { RowSortSpec } from './rowSortAutorun.ts'
import type { TreeSpatialIndex } from './spatialIndex.ts'
import type { SvgSidebarProps } from './svgSidebarWidth.ts'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
  RowSource,
} from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

/**
 * The whole of what `TreeSidebarMixin` needs a composing display to be: the
 * `rows` object, its axis, colors and color channel, and the resolved row
 * height.
 */
export interface TreeSidebarHost {
  configuration: TreeSidebarConfigModel & { displayId: string }
  effectiveRowHeight: number
}

const host = (self: object) => self as TreeSidebarHost

type ArrangementMember = (typeof ROW_ARRANGEMENT_MEMBERS)[number]
type Arrangement = Partial<Record<ArrangementMember | 'filter', unknown>>

// A row's name, label and colors are what a row color is set on, never what
// one is set by.
const NOT_COLOR_FIELDS = new Set<string>([
  ...IDENTITY_FIELDS,
  'id',
  'label',
  'color',
  'rowColor',
])

// What "Reset row order" is offered on: the shown rows have a clear of their
// own, the chip's "Show all", and a reset still takes them with the rest.
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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// The base's `rows` in the spelling the live one is stored in, so a
// `rows.tree` written as its newick compares equal to the object it lifts to,
// less what names the base field's rows once the live rows are on another
// field (the keyed rule, ADR-257), so a reset returns no arrangement of the
// old rows to the new ones
function baseArrangement(self: object): Arrangement {
  const { rows } = baseDisplayConfig(self)
  const live: AnyConfigurationModel = host(self).configuration.rows
  const meta = getConfigurationSchemaMetadata(live)!
  const { writes } = meta.options
  const base: Arrangement = isRecord(rows) ? canonicalSpelling(meta, rows) : {}
  return isKeyedWrites(writes)
    ? keyedBase(writes, base, {
        [writes.keyedBy]: readConfObject(live, writes.keyedBy),
      })
    : base
}

// A member of the `rows` this display's base declares, none where it writes
// the field alone
function baseRowsMember(self: object, member: string) {
  const { rows } = baseDisplayConfig(self)
  return isRecord(rows) ? rows[member] : undefined
}

function liveArrangement(self: object): Arrangement {
  return getSnapshot(host(self).configuration.rows)
}

// `rows.filter`, none where the display declares no filter on its rows
function storedRowFilter(self: object): FieldPredicate[] {
  return predicatesOf(Reflect.get(host(self).configuration.rows, 'filter'))
}

function storedTree(self: object): string | undefined {
  return getConf(host(self), ['rows', 'tree', 'newick'])
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
 * Whether the names of `order` that `leaves` holds appear in `leaves`' order.
 */
function listsInOrder(leaves: readonly string[], order: readonly string[]) {
  const position = new Map(leaves.map((name, i) => [name, i]))
  let last = -1
  for (const name of order) {
    const at = position.get(name)
    if (at !== undefined) {
      if (at < last) {
        return false
      }
      last = at
      position.delete(name)
    }
  }
  return true
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
 * #crossCuttingMixin Row set with a dendrogram sidebar, its arrangement and its row colors the display's `rows` config object (`rows.colors` pinned on rows, `rows.color` mapped from an attribute), each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`editableSources`, `clusterableSources`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows`, and `guideTreeNewick` where its adapter has a tree, and overrides the hooks its rows need
 *
 * The rows are derived in stages, each a separate computed: the display's
 * `discoveredRows`, then `expandedRows` (`expandRows`: a variant display's
 * haplotypes), then `editableSources`, ordered by `rowOrder`, relabelled by
 * `rows.labels` and each with its resolved color as `rowColor`, then
 * `clusterableSources`, narrowed to the focus, then `bandedSources`, stacked
 * in the bands `rowBanding` names.
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
    .views(self => ({
      /**
       * #getter
       * Whether the dendrogram sidebar is drawn.
       */
      get showTree(): boolean {
        return getConf(host(self), ['rows', 'axis', 'tree'])
      },
      /**
       * #getter
       * Whether the tree draws nodes at their branch length (dendrogram) or
       * evenly by topology (cladogram).
       */
      get showBranchLength(): boolean {
        return getConf(host(self), ['rows', 'axis', 'branchLength'])
      },
      /**
       * #getter
       * Whether each row's name is drawn over the left of the plot.
       */
      get showRowLabels(): boolean {
        return getConf(host(self), ['rows', 'axis', 'labels'])
      },
      /**
       * #getter
       * Width in px of the sidebar the dendrogram draws in. On the config
       * rather than the display snapshot for the same reason `height` is: the
       * config node outlives the display instance, so a dragged width survives
       * unticking and reticking the track.
       */
      get treeAreaWidth(): number {
        return getConf(host(self), ['rows', 'axis', 'width'])
      },
      /**
       * #getter
       * The row order, `rows.sort`: the rows it names lead, in its order,
       * and the rest follow as `unlistedRowsSort` says.
       */
      get rowSort(): string[] {
        return getConf(host(self), ['rows', 'sort'])
      },
      /**
       * #getter
       * The labels drawn in place of row names, `rows.labels`, by name.
       */
      get rowLabels(): Readonly<Record<string, string>> {
        return getConf(host(self), ['rows', 'labels'])
      },
      /**
       * #getter
       * What `rowTree` was computed from, the locus and the settings; undefined
       * for a tree that arrived as data, and while no newick is stored, since
       * a provenance describes only the newick beside it.
       */
      get rowTreeProvenance(): ClusterProvenance | undefined {
        return storedTree(self)
          ? getConf(host(self), ['rows', 'tree', 'provenance'])
          : undefined
      },
      /**
       * #getter
       * Overridable hook: the row names a focus narrows the display to,
       * `rows.kept` — a clade picked off the tree or a key row's rows — or
       * undefined while every row shows. A display that can hide its rows
       * answers undefined while they are hidden.
       */
      get rowFocus(): readonly string[] | undefined {
        const kept: string[] = getConf(host(self), ['rows', 'kept'])
        return kept.length ? kept : undefined
      },
      /**
       * #getter
       * Overridable hook: `rows.filter`, the predicates over row attributes
       * a row must pass to show, none where the display declares none. A
       * display that can hide its rows answers none while they are hidden.
       */
      get rowFilter(): readonly FieldPredicate[] {
        return storedRowFilter(self)
      },
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
      /**
       * #getter
       * The `rows.color` object: the row field whose values take colors,
       * `name` where it names none, and the values with an assigned color.
       */
      get rowColorChannel(): RowColorSetting {
        return rowColorSettingOf(host(self).configuration.rows.color)
      },
      /**
       * #getter
       * The colors pinned on rows, `rows.colors`, by name.
       */
      get rowColorPins(): ReadonlyMap<string, string> {
        return pinnedColorsOf(getConf(host(self), ['rows', 'colors']))
      },
      /**
       * #getter
       * The `rows.color` object this display's base declares, which a reset
       * returns to and "is this the reader's" compares against.
       */
      get baseRowColorChannel(): RowColorSetting {
        return liftRowColor(baseRowsMember(self, 'color'))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `rows.color` with the pins folded in under `name`
       * (`withPinnedColors`), the shape the deal, the choice and the key
       * read.
       */
      get rowColorSetting(): RowColorSetting {
        return withPinnedColors(self.rowColorChannel, self.rowColorPins)
      },
      /**
       * #getter
       * `rowColorSetting` as this display's base declares it.
       */
      get baseRowColorSetting(): RowColorSetting {
        return withPinnedColors(
          self.baseRowColorChannel,
          pinnedColorsOf(baseArrangement(self).colors),
        )
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
       * Overridable hook: the guide tree the display's adapter supplies, as
       * newick, which `rowTree` draws while some rotation of it lists
       * `rows.sort`. It never enters `rows.tree`, since the adapter
       * re-supplies it on every load. `undefined` by default.
       */
      get guideTreeNewick(): string | undefined {
        return undefined
      },
      /**
       * #method
       * Overridable hook: the row `row` refines, read off the row itself, for
       * a display whose rows stand for something named by another name (a
       * variant display's haplotype row refines its sample, a MAF copy row
       * its species), and what its label adds to that row's. An order, a
       * label, a color and a focus written against the parent reach every row
       * refining it. None by default.
       */
      rowParent(_row: S): RowParent | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook: the rows a finer field would draw, each refining a
       * drawn row (`rowParent`), so an order or a focus naming one reaches
       * the row it refines: a sample-mode variant display's haplotype rows.
       * None by default.
       */
      get finerRows(): S[] {
        return []
      },
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
       * Overridable hook: where the rows `rowOrder` does not list go, in the
       * order they arrived by default.
       */
      get unlistedRowsSort(): UnlistedRowsSort {
        return 'source'
      },
      /**
       * #getter
       * Overridable hook: the field the rows stack in bands by and the
       * bands listed first, or undefined, the default, for no bands.
       */
      get rowBanding(): RowBanding | undefined {
        return undefined
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
       * Overridable hook: the px of bands, an axis inset or anything else the
       * display stacks above its rows, 0 by default.
       */
      get rowsHeaderHeight(): number {
        return 0
      },
    }))
    .views(self => ({
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
       * Overridable hook: the name each row also answers to, read off
       * `rowParent`: a refining row its parent's, and a `finerRows` row the
       * drawn row it refines. Undefined while no row refines another. MAF
       * reads it off a copy row's name instead, since a copy exists at some
       * loci only and a stored name must answer where no block aligns it.
       */
      get rowAlias(): RowAlias | undefined {
        return rowAliasOver(self.expandedRows, self.finerRows, row =>
          self.rowParent(row),
        )
      },
      /**
       * #getter
       * The rows refining each parent no row draws, in their order: what a
       * tree leaf naming that parent forks into, as a sample leaf of a tree
       * clustered per sample forks over its haplotype rows.
       */
      get rowForks(): ReadonlyMap<string, readonly string[]> {
        const rows = self.expandedRows
        const drawn = new Set(rows.map(row => row.name))
        const forks = new Map<string, string[]>()
        for (const row of rows) {
          const parent = self.rowParent(row)?.name
          if (parent !== undefined && !drawn.has(parent)) {
            const kids = forks.get(parent)
            if (kids) {
              kids.push(row.name)
            } else {
              forks.set(parent, [row.name])
            }
          }
        }
        return forks
      },
      /**
       * #getter
       * What narrows the rows shown: `rowFilter`, then `rowFocus`, through
       * `rowAlias`. The one narrowing the rows drawn, the rows a run
       * clusters, the tree, a fetch's samples and an export all read.
       */
      get rowNarrowing(): RowNarrowing {
        return {
          kept: self.rowFocus ?? [],
          filter: self.rowFilter,
          rowAlias: this.rowAlias,
        }
      },
      /**
       * #method
       * `rows` narrowed by `rowNarrowing`: `filter`, then `kept`.
       */
      narrowRows<T extends { name: string }>(rows: T[]): T[] {
        return narrowRows(rows, this.rowNarrowing)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the "Showing N of M rows" chip shows: something narrows the
       * rows, and the rows are known, so no "0 of 0" shows before the first
       * region lands.
       */
      get rowNarrowingShows(): boolean {
        return narrows(self.rowNarrowing) && self.expandedRows.length > 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The line the "Showing N of M rows" chip takes above the first row
       * while `rowNarrowingShows`, 0 otherwise.
       */
      get rowFocusLineHeight(): number {
        return self.rowNarrowingShows ? SIDEBAR_HINT_LINE_PX : 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Where the rows start in the display's box: under the display's own
       * `rowsHeaderHeight` and the focus chip's line. Every row painter, hit
       * test, label, tree and export places the rows from here.
       */
      get rowsTopOffset(): number {
        return self.rowsHeaderHeight + self.rowFocusLineHeight
      },
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
    .views(self => ({
      /**
       * #getter
       * `guideTreeNewick` parsed and rotated towards `rows.sort`; undefined
       * while the display supplies none.
       */
      get guideTree() {
        const newick = self.guideTreeNewick
        return newick ? buildTree(newick, self.rowSort) : undefined
      },
      /**
       * #getter
       * Whether the rotated guide tree lists `rows.sort`'s names in
       * `rows.sort`'s order, which holds exactly when some rotation of it
       * does.
       */
      get guideTreeHonoursDomain(): boolean {
        const { guideTree } = this
        return (
          !!guideTree && listsInOrder(getLeafNames(guideTree), self.rowSort)
        )
      },
      /**
       * #getter
       * The tree that arranges the rows, as newick: `rows.tree`, else the
       * guide tree while `guideTreeHonoursDomain`. A reorder no rotation
       * produces hides the guide tree, and a reset brings it back.
       */
      get rowTree(): string | undefined {
        return (
          storedTree(self) ??
          (this.guideTreeHonoursDomain ? self.guideTreeNewick : undefined)
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * Overridable hook: the band a row stacks in while `rowBanding` is set,
       * by default its value of the banding field, '' for none.
       */
      rowBand(row: S): string {
        const banding = self.rowBanding
        return banding ? rowFieldValue(row, banding.field) : ''
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `rowTree` parsed. A run rotated its tree in the same write as the
       * order it produced; a tree that arrived as data rotates towards
       * `rows.sort` here, and the guide tree is `guideTree`'s parse.
       */
      get parsedTree() {
        const tree = storedTree(self)
        if (tree) {
          const forks = self.rowForks
          return buildTree(
            tree,
            self.rowTreeProvenance ? [] : self.rowSort,
            forks.size > 0 ? leaf => forks.get(leaf) : undefined,
          )
        }
        return self.guideTreeHonoursDomain ? self.guideTree : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: the row names in display order. A tree that
       * arrived as data (a supplied `rows.tree` or a guide tree) leads with
       * its leaves, then `rows.sort` for the rows it lacks. `rows.sort`
       * alone otherwise, since a computed tree's run wrote its leaf order
       * there and a later `rows.sort` write is the reader's.
       */
      get rowOrder(): readonly string[] {
        const { parsedTree, rowSort, rowTreeProvenance } = self
        return parsedTree && !rowTreeProvenance
          ? [...getLeafNames(parsedTree), ...rowSort]
          : rowSort
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: whether the rows share one panel, so nothing but
       * color tells them apart. False by default.
       */
      get sharesPanel(): boolean {
        return false
      },
      /**
       * #getter
       * Overridable hook: whether a row's color paints its data marks, which
       * holds while nothing else colors them. True by default.
       */
      get rowColorPaintsMarks(): boolean {
        return true
      },
      /**
       * #getter
       * Overridable hook: what one row is called, which titles the row color
       * key where it lists the rows by name in a shared panel. "Row" by
       * default, which only a display that shares a panel would
       * show; a wiggle overlay's rows are subtracks.
       */
      get rowNoun(): string {
        return 'Row'
      },
      /**
       * #getter
       * Overridable hook: the row fields that are display plumbing,
       * which the arrangement dialog never lists as a column.
       */
      get internalRowFields(): readonly string[] {
        return []
      },
      /**
       * #getter
       * Overridable hook: the row fields a reader can color the rows by,
       * offered beside None and Each row. By default every field a row
       * has but its name, label and colors.
       */
      get rowColorFields(): readonly string[] {
        return extraColumns(self.expandedRows, NOT_COLOR_FIELDS)
      },
      /**
       * #getter
       * The `rows.filter` this display's base declares, which "Show all"
       * and "Reset row order" return to.
       */
      get baseRowFilter(): FieldPredicate[] {
        return predicatesOf(baseRowsMember(self, 'filter'))
      },
      /**
       * #method
       * The notice for a top-level `filter` field no loaded `record`
       * carries: where a row carries it, a pointer at `rows.filter`, which
       * keeps rows by their attributes, where the top-level `filter` tests
       * records.
       */
      unreadFilterFieldNotice(field: string, record: string) {
        return this.rowColorFields.includes(field)
          ? `The filter tests "${field}", a row attribute no loaded ${record} carries, so it hides every ${record}: rows.filter keeps rows by their attributes`
          : unreadFieldNotice(field, record)
      },
      /**
       * #getter
       * A line for the corner notice when rows have arrived and none has
       * the field `rowBanding` bands by, which then bands nothing. Each
       * display spreads it into its `notices`.
       */
      get rowBandingNotices(): string[] {
        const banding = self.rowBanding
        const rows = self.expandedRows
        return banding &&
          rows.length > 0 &&
          rows.every(row => self.rowBand(row) === '')
          ? [
              `facet.field: no row carries ${banding.field}, so it bands nothing`,
            ]
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the palette deals each row a color by name: only where the
       * rows share one panel and their color paints the marks.
       */
      get rowPaletteDeals(): boolean {
        return self.sharesPanel && self.rowColorPaintsMarks
      },
      /**
       * #getter
       * The rows the palette deals over: `expandedRows`, in the order their
       * source lists them, so no `rows.sort` (the config's or a reorder's),
       * focus or relabel recolors a row, and a tables export deals the same.
       */
      get rowColorDealRows(): readonly S[] {
        return self.expandedRows
      },
      /**
       * #method
       * Overridable hook: the values of the row field `field` the config
       * declares, which the palette deals first, in this order, whether or
       * not a loaded row carries them, so a row arriving later moves no
       * color. None by default.
       */
      rowColorDeclaredValues(_field: string): readonly string[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #method
       * The color each value takes under `setting` (`dealValueColors`),
       * which the arrangement dialog shows before it writes the setting.
       */
      dealtValueColorsFor(
        setting: RowColorSnapshot,
      ): ReadonlyMap<string, string> {
        const lifted = liftRowColor(setting)
        return dealValueColors(
          lifted,
          () => self.rowColorDealRows,
          self.rowPaletteDeals,
          self.rowColorDeclaredValues(lifted.field),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether `rows.color` gives its field's values colors the config does
       * not, so "Reset row order" is offered for a recolor too: whether
       * `rowColorResetTarget` has anything to write. A choice of row color
       * source is no arrangement, so it is never custom. The pins are an
       * arrangement member.
       */
      get rowColorIsCustom(): boolean {
        return (
          rowColorResetTarget(
            self.rowColorChannel,
            self.baseRowColorChannel,
            self.rowPaletteDeals,
          ) !== undefined
        )
      },
      /**
       * #getter
       * The choice of what colors the rows, as the arrangement dialog and a menu
       * offer it: '' for none dealt, `name` for a palette color each, or a
       * field.
       */
      get rowColorChoice(): string {
        return rowColorChoiceOf(self.rowColorChannel, self.rowPaletteDeals)
      },
      /**
       * #method
       * The `rows.color` object `choice` starts from (`startingRowColor`):
       * the current object's where it shows that choice, else the config's.
       */
      rowColorFor(choice: string): RowColorSetting {
        return startingRowColor(
          choice,
          [self.rowColorChannel, self.baseRowColorChannel],
          self.rowPaletteDeals,
        )
      },
      /**
       * #getter
       * The field that colors the rows, or '' for `name`.
       */
      get rowColorField(): string {
        const { field } = self.rowColorSetting
        return field === 'name' ? '' : field
      },
      /**
       * #getter
       * The color each value of the config's `rows.color` field takes,
       * listed pairs first and then in the order dealt.
       */
      get dealtValueColors(): ReadonlyMap<string, string> {
        return self.dealtValueColorsFor(self.rowColorSetting)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The fields a reader can color the rows by: `rowColorFields`, and
       * the current one where the rows lack it, so it still shows as chosen.
       */
      get rowColorFieldsOffered(): readonly string[] {
        const current = self.rowColorChoice
        return current === '' ||
          current === 'name' ||
          self.rowColorFields.includes(current)
          ? self.rowColorFields
          : [...self.rowColorFields, current]
      },
      /**
       * #getter
       * Each row's color, by name: its `rows.colors` entry, else its
       * `rows.color` entry, else the row's `color`, else the palette's where
       * `rowPaletteDeals`. The one answer every display paints a row's color
       * from.
       */
      get resolvedRowColors(): ReadonlyMap<string, string> {
        return resolveRowColors(
          self.expandedRows,
          self.rowColorSetting.field,
          self.dealtValueColors,
          self.rowColorPins,
          self.rowAlias,
        )
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
          self.rowColorIsCustom ||
          ORDER_MEMBERS.some(
            member =>
              !compareStructural(present(live[member]), present(base[member])),
          )
        )
      },
      /**
       * #getter
       * The rows in the reader's arrangement, each with its resolved color
       * as `rowColor`, and with no focus or band: the list the arrangement dialog
       * edits, so a submit writes back only what the reader chose.
       * `expandedRows` itself while nothing is arranged or colored.
       */
      get editableSources(): S[] {
        return withRowColors(
          arrangeRows(
            self.expandedRows,
            { domain: self.rowOrder, labels: self.rowLabels },
            self,
          ),
          self.resolvedRowColors,
        )
      },
      /**
       * #getter
       * What the row color key and its focus read of the colors.
       */
      get rowColorKeyInputs(): RowColorKeyInputs {
        const setting = self.rowColorSetting
        return {
          setting,
          pairs: pairedColorsOf(setting.scale),
          dealt: self.dealtValueColors,
          resolved: self.resolvedRowColors,
          pinned: self.rowColorPins,
          alias: self.rowAlias,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The row color key, which every display spreads into its
       * `colorScales`: one scale titled by the `rows.color` field, or none
       * where it has no entries. Its entries (`rowColorKeyEntries`) show
       * where the labels cannot name the colors: by a field, where a row
       * `rows.colors` pins takes an entry by its label, or by name in a
       * shared panel. By name on stacked rows the labels are the key.
       */
      get rowColorScales(): CategoricalScale[] {
        const field = self.rowColorField
        if (!field && !self.sharesPanel) {
          return []
        }
        const labels = new Map(
          self.editableSources.map(row => [row.name, row.label ?? row.name]),
        )
        const entries = rowColorKeyEntries(
          self.rowColorDealRows,
          self.rowColorKeyInputs,
          name => labels.get(name) ?? name,
        )
        return entries.length > 0
          ? [
              {
                kind: 'categorical',
                id: ROW_COLOR_SCALE_ID,
                title: field ? capitalizeFirst(field) : self.rowNoun,
                focusesRows: true,
                entries,
              },
            ]
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: `editableSources` narrowed to the focus, the rows a
       * clustering run clusters, and deliberately not the display's decorated
       * `sources`, whose palette and band a run has no business writing back.
       * MAF applies a focus as given on a track that discovers its species.
       */
      get clusterableSources(): S[] {
        return self.narrowRows(self.editableSources)
      },
      /**
       * #getter
       * The tree a reorder rotates rather than drops, as newick: a supplied
       * `rows.tree`, one with no provenance, else the guide tree while
       * `guideTreeHonoursDomain`. A computed tree is never one, since its run
       * rotated it already.
       */
      get rotatableRowTree(): string | undefined {
        const tree = storedTree(self)
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
          !movesNoRow(next, self.editableSources) &&
          self.orderDropsRowTree(orderOver(self.rowSort, next))
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The parsed tree narrowed by `rowNarrowing`, a leaf no row has
       * reading as a row with no attributes; none where it keeps no leaf.
       */
      get root() {
        const tree = self.parsedTree
        const narrowing = self.rowNarrowing
        // the rows' attributes, read only where a filter tests them, so a
        // region arrival re-prunes no tree `kept` alone narrows
        const rows = new Map<string, { name: string }>(
          narrowing.filter.length > 0
            ? self.expandedRows.map(row => [row.name, row])
            : [],
        )
        const leaves =
          tree && narrows(narrowing)
            ? narrowRows(
                getLeafNames(tree).map(name => rows.get(name) ?? { name }),
                narrowing,
              ).map(leaf => leaf.name)
            : undefined
        return tree && leaves
          ? leaves.length > 0
            ? treeOfLeaves(tree, leaves)
            : undefined
          : tree
      },
      /**
       * #getter
       * `bandedSources` and `rowBands`, from one pass over the rows.
       */
      get bandedRows() {
        const banding = self.rowBanding
        const rows = self.clusterableSources
        return banding
          ? bandRows(rows, row => self.rowBand(row), banding)
          : { rows, bands: [] }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `clusterableSources` stacked in bands by `rowBanding`, each band's rows
       * in their arranged order: the rows each display paints its palette
       * over. `clusterableSources` itself while nothing bands.
       */
      get bandedSources(): S[] {
        return self.bandedRows.rows
      },
      /**
       * #getter
       * Each band's value, label and the rows it spans in `bandedSources`;
       * none while nothing bands.
       */
      get rowBands(): readonly RowBand[] {
        return self.bandedRows.bands
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: the rows drawn, top to bottom, `bandedSources` by
       * default. MAF drops its hidden reference row.
       */
      get sources(): S[] {
        return self.bandedSources
      },
      /**
       * #getter
       * Overridable hook: whether the declarative `runClustering` run may
       * start, two or more `clusterableSources` by default.
       */
      get autoClusterReady(): boolean {
        return self.clusterableSources.length > 1
      },
      /**
       * #getter
       * Overridable hook: the tree `hierarchy` positions, `root` by default.
       * `computeClusterHierarchy` declines to position a tree whose leaves are
       * no longer the rows drawn, so a display that hides a row prunes it from
       * the tree here too, or the whole dendrogram goes with the row.
       */
      get treeRoot() {
        return self.root
      },
      /**
       * #getter
       * Overridable hook: whether the dendrogram draws at all, true by
       * default; off wherever the rows it would lay against are not drawn.
       * This is the single gate: the on-screen sidebar, the SVG export,
       * `spatialIndex` (subtree hover) and the tooltip dead zone the sidebar
       * reserves all read `hierarchy`, so nothing keeps drawing or reserving
       * space when the tree is off.
       */
      get drawsTree(): boolean {
        return true
      },
    }))
    .views(self => ({
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
       * The px the rows stack to, `sources` × `effectiveRowHeight`, which the
       * dendrogram's leaves spread over: the content the rows scroll through,
       * never the viewport they scroll inside.
       */
      get rowsContentHeight(): number {
        return self.sources.length * host(self).effectiveRowHeight
      },
      /**
       * #getter
       * The dendrogram positioned against the rows drawn, or undefined while
       * there is no tree or `drawsTree` is off. `computeClusterHierarchy`
       * checks the tree's leaves against the drawn row names, the backstop
       * against anything reordering `sources` downstream of the arrangement:
       * such a reorder drops the dendrogram rather than drawing it against
       * rows it does not name.
       */
      get hierarchy(): ClusterHierarchyNode | undefined {
        return self.drawsTree
          ? computeClusterHierarchy(
              self.treeRoot,
              self.sources,
              this.rowsContentHeight,
              self.treeAreaWidth,
              self.showBranchLength,
              self.rowBands,
            )
          : undefined
      },
      /**
       * #getter
       * The hit index the sidebar's subtree hover reads, built from
       * `hierarchy`.
       */
      get spatialIndex(): TreeSpatialIndex | undefined {
        const { hierarchy } = this
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
        const { rowBands, bandedSources } = self
        return rowBands.length > 1
          ? rowBands.map(({ start, end }) =>
              bandedSources.slice(start, end).map(row => row.name),
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
          ? matchBandClades(root, self.bandedSources, rowBands).filter(
              clade => !clade,
            ).length
          : 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether "Show all" has anything to clear: `rows.kept` names rows, or
       * `rows.filter` differs from the config's.
       */
      get rowNarrowingClears(): boolean {
        return (
          (self.rowFocus?.length ?? 0) > 0 ||
          !compareStructural(
            present(liveArrangement(self).filter),
            present(baseArrangement(self).filter),
          )
        )
      },
      /**
       * #getter
       * The corner notice's lines on the narrowing, once the rows are known:
       * a `rows.filter` field no row carries, what left no row where none
       * shows, and where the track lists its rows up front
       * (`rowsListedUpFront`), the `rows.kept` names no row has. Each
       * display spreads it into its `notices`.
       */
      get rowNarrowingNotices(): string[] {
        const rows = self.expandedRows
        const narrowing = self.rowNarrowing
        const unread = unreadRowFields(rows, narrowing.filter)
        const emptiedBy =
          rows.length > 0 && self.clusterableSources.length === 0
            ? filteredRows(rows, narrowing.filter).length === 0
              ? 'filter'
              : keptRows(rows, narrowing.kept, narrowing.rowAlias).length > 0
                ? 'hidden'
                : 'kept'
            : undefined
        const filterText = rowFilterText(narrowing.filter)
        const unmatched = self.rowsListedUpFront
          ? unmatchedKeptNames(rows, narrowing).filter(
              name => !self.rowFoundAtSomeLoci(name),
            )
          : []
        return rows.length === 0
          ? []
          : [
              ...unread.map(
                field =>
                  `rows.filter tests "${field}", which no row carries, so it filters out every row`,
              ),
              ...(emptiedBy === 'filter' && unread.length === 0
                ? [`Every row is filtered out by rows.filter (${filterText})`]
                : []),
              ...(emptiedBy === 'hidden'
                ? [
                    `Every row rows.kept names is hidden by rows.filter (${filterText})`,
                  ]
                : []),
              ...(emptiedBy === 'kept'
                ? [
                    `rows.kept names no row${unmatched.length ? ` (${listedNames(unmatched)})` : ' here'}, so no row shows`,
                  ]
                : unmatched.length > 0
                  ? [
                      `rows.kept names ${listedNames(unmatched)}, which no row has`,
                    ]
                  : []),
            ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The chip above the rows while `rowNarrowingShows`: "Showing N of M
       * rows", with "Show all" where `rowNarrowingClears`, and the config's
       * own `rows.filter`, which "Show all" keeps, stated in its tooltip.
       */
      get rowNarrowingHint(): { text: string; title: string } | undefined {
        const base = rowFilterText(self.baseRowFilter)
        const clears = self.rowNarrowingClears
        return self.rowNarrowingShows
          ? {
              text: `Showing ${self.clusterableSources.length} of ${self.expandedRows.length} rows${clears ? ' · Show all' : ''}`,
              title: [
                ...(clears ? ['Click to show every row again'] : []),
                ...(base
                  ? [`The track's config keeps rows where ${base}`]
                  : []),
              ].join('. '),
            }
          : undefined
      },
    }))
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
          writeRowFilter(baseArrangement(self).filter)
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
              shown: self.editableSources,
              adapter: self.expandedRows,
              labels: self.rowLabels,
              rowParent: row => self.rowParent(row),
            }),
          )
          if (!movesNoRow(rows, self.editableSources)) {
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
          const base = baseArrangement(self)
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
            ? filteredRows(self.editableSources, self.rowFilter)
                .filter(row => rowColorKeyValue(row, key) === value)
                .map(row => row.name)
            : []
        if (names.length > 0) {
          focusRows(
            self as typeof self & { setScrollTop(top: number): void },
            names,
          )
        }
      },
    }))
}
