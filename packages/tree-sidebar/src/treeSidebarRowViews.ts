import { getConf } from '@jbrowse/core/configuration'
import { capitalizeFirst } from '@jbrowse/core/util'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'

import { arrangeRows, bandRows, rowAliasOver } from './arrangeRows.ts'
import {
  buildTree,
  computeClusterHierarchy,
  getLeafNames,
  treeOfLeaves,
} from './clusterUtils.ts'
import { narrowRows, narrows } from './narrowRows.ts'
import {
  liftRowColor,
  pinnedColorsOf,
  rowColorSettingOf,
} from './rowColorChoice.ts'
import {
  ROW_COLOR_SCALE_ID,
  dealValueColors,
  resolveRowColors,
  rowColorKeyEntries,
  rowFieldValue,
  withPinnedColors,
  withRowColors,
} from './rowColorScale.ts'
import { SIDEBAR_HINT_LINE_PX } from './treeSidebarGeometry.ts'

import type {
  RowAlias,
  RowBand,
  RowBanding,
  RowParent,
  UnlistedRowsSort,
} from './arrangeRows.ts'
import type { ClusterProvenance } from './clusterProvenance.ts'
import type { HierarchyNode } from './hierarchy.ts'
import type { RowNarrowing } from './narrowRows.ts'
import type { RowColorSnapshot } from './rowColorChoice.ts'
import type { RowColorKeyInputs, RowColorSetting } from './rowColorScale.ts'
import type {
  ClusterHierarchyNode,
  ClusterNodeData,
  RowSource,
} from './types.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'

/**
 * The `rows` every display composing `TreeSidebarMixin` declares: MAF's
 * field-less `RowArrangement`, or a `Rows` adding `field`, `filter` and the
 * axis `grid` to it.
 */
export type TreeSidebarConfigModel = ConfigModelForFields<{
  rows: typeof rowArrangementConfigSchema
}>

/**
 * What the row config views read: a display, or a plain host carrying a
 * display's config.
 */
export interface TreeSidebarRowsConfigHost {
  configuration: TreeSidebarConfigModel
}

/**
 * The arrangement members the rows are derived from, read off the display's
 * `rows` config.
 */
export function treeSidebarRowsConfigViews(self: TreeSidebarRowsConfigHost) {
  return {
    /**
     * #getter
     * The row order, `rows.sort`: the rows it names lead, in its order,
     * and the rest follow as `unlistedRowsSort` says.
     */
    get rowSort(): string[] {
      return getConf(self, ['rows', 'sort'])
    },
    /**
     * #getter
     * The labels drawn in place of row names, `rows.labels`, by name.
     */
    get rowLabels(): Readonly<Record<string, string>> {
      return getConf(self, ['rows', 'labels'])
    },
    /**
     * #getter
     * The newick `rows.tree` stores, a clustering run's or one that arrived
     * as data; undefined while none is stored.
     */
    get storedRowTree(): string | undefined {
      return getConf(self, ['rows', 'tree', 'newick'])
    },
    /**
     * #getter
     * What `rowTree` was computed from, the locus and the settings; undefined
     * for a tree that arrived as data, and while no newick is stored, since
     * a provenance describes only the newick beside it.
     */
    get rowTreeProvenance(): ClusterProvenance | undefined {
      return getConf(self, ['rows', 'tree', 'newick'])
        ? getConf(self, ['rows', 'tree', 'provenance'])
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
      const kept: string[] = getConf(self, ['rows', 'kept'])
      return kept.length ? kept : undefined
    },
    /**
     * #getter
     * Overridable hook: `rows.filter`, the predicates over row attributes
     * a row must pass to show, none where the display declares none. A
     * display that can hide its rows answers none while they are hidden.
     */
    get rowFilter(): readonly FieldPredicate[] {
      return predicatesOf(Reflect.get(self.configuration.rows, 'filter'))
    },
    /**
     * #getter
     * The `rows.color` object: the row field whose values take colors,
     * `name` where it names none, and the values with an assigned color.
     */
    get rowColorChannel(): RowColorSetting {
      return rowColorSettingOf(self.configuration.rows.color)
    },
    /**
     * #getter
     * The colors pinned on rows, `rows.colors`, by name.
     */
    get rowColorPins(): ReadonlyMap<string, string> {
      return pinnedColorsOf(getConf(self, ['rows', 'colors']))
    },
  }
}

/**
 * The hooks the row views read, at what a display that overrides none
 * answers.
 */
export function treeSidebarRowHookDefaults<S extends RowSource>() {
  return {
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
     * Overridable hook: the px of bands, an axis inset or anything else the
     * display stacks above its rows, 0 by default.
     */
    get rowsHeaderHeight(): number {
      return 0
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
  }
}

/**
 * What the row views read off their host: the `rows` config and the hooks,
 * a display's overrides where it has them.
 */
export type TreeSidebarRowInputs<S extends RowSource> = ReturnType<
  typeof treeSidebarRowsConfigViews
> &
  ReturnType<typeof treeSidebarRowHookDefaults<S>>

type ExpandedRowsHost<S extends RowSource> = TreeSidebarRowInputs<S> &
  ReturnType<typeof expandedRowViews<S>>
type RowAliasHost<S extends RowSource> = ExpandedRowsHost<S> &
  ReturnType<typeof rowAliasViews<S>>
type RowTreeHost<S extends RowSource> = RowAliasHost<S> &
  ReturnType<typeof rowTreeViews<S>>
type RowOrderHost<S extends RowSource> = RowTreeHost<S> &
  ReturnType<typeof rowOrderViews<S>>
type RowColorsHost<S extends RowSource> = RowOrderHost<S> &
  ReturnType<typeof resolvedRowColorViews<S>>
type EditableRowsHost<S extends RowSource> = RowColorsHost<S> &
  ReturnType<typeof editableRowViews<S>>
type ClusterableRowsHost<S extends RowSource> = EditableRowsHost<S> &
  ReturnType<typeof clusterableRowViews<S>>
type BandedRowsHost<S extends RowSource> = ClusterableRowsHost<S> &
  ReturnType<typeof bandedRowViews<S>>
type BandedSourcesHost<S extends RowSource> = BandedRowsHost<S> &
  ReturnType<typeof bandedSourceViews<S>>

/**
 * The first stage of the rows a display draws: the rows at the granularity
 * drawn, and what reads the hooks alone.
 */
export function expandedRowViews<S extends RowSource>(
  self: TreeSidebarRowInputs<S>,
) {
  return {
    /**
     * #getter
     * `discoveredRows` through `expandRows`: the rows at the granularity
     * drawn, before any arrangement.
     */
    get expandedRows(): S[] {
      return self.expandRows(self.discoveredRows)
    },
    /**
     * #method
     * Overridable hook: the band a row stacks in while `rowBanding` is set,
     * by default its value of the banding field, '' for none.
     */
    rowBand(row: S): string {
      const banding = self.rowBanding
      return banding ? rowFieldValue(row, banding.field) : ''
    },
    /**
     * #getter
     * `guideTreeNewick` parsed and rotated towards `rows.sort`; undefined
     * while the display supplies none.
     */
    get guideTree(): HierarchyNode<ClusterNodeData> | undefined {
      const newick = self.guideTreeNewick
      return newick ? buildTree(newick, self.rowSort) : undefined
    },
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
     * `rows.color` with the pins folded in under `name`
     * (`withPinnedColors`), the shape the deal, the choice and the key
     * read.
     */
    get rowColorSetting(): RowColorSetting {
      return withPinnedColors(self.rowColorChannel, self.rowColorPins)
    },
  }
}

/** The second stage: what reads the expanded rows. */
export function rowAliasViews<S extends RowSource>(self: ExpandedRowsHost<S>) {
  return {
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
     * Whether the rotated guide tree lists `rows.sort`'s names in
     * `rows.sort`'s order, which holds exactly when some rotation of it
     * does.
     */
    get guideTreeHonoursDomain(): boolean {
      const { guideTree } = self
      return !!guideTree && listsInOrder(getLeafNames(guideTree), self.rowSort)
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
     * #getter
     * The field that colors the rows, or '' for `name`.
     */
    get rowColorField(): string {
      const { field } = self.rowColorSetting
      return field === 'name' ? '' : field
    },
  }
}

/** The third stage: the narrowing, the tree and the deal. */
export function rowTreeViews<S extends RowSource>(self: RowAliasHost<S>) {
  return {
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
        rowAlias: self.rowAlias,
      }
    },
    /**
     * #getter
     * The tree that arranges the rows, as newick: `rows.tree`, else the
     * guide tree while `guideTreeHonoursDomain`. A reorder no rotation
     * produces hides the guide tree, and a reset brings it back.
     */
    get rowTree(): string | undefined {
      return (
        self.storedRowTree ??
        (self.guideTreeHonoursDomain ? self.guideTreeNewick : undefined)
      )
    },
    /**
     * #getter
     * `rowTree` parsed. A run rotated its tree in the same write as the
     * order it produced; a tree that arrived as data rotates towards
     * `rows.sort` here, and the guide tree is `guideTree`'s parse.
     */
    get parsedTree(): HierarchyNode<ClusterNodeData> | undefined {
      const tree = self.storedRowTree
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
  }
}

/** The fourth stage: the order and the dealt colors. */
export function rowOrderViews<S extends RowSource>(self: RowTreeHost<S>) {
  return {
    /**
     * #method
     * `rows` narrowed by `rowNarrowing`: `filter`, then `kept`.
     */
    narrowRows<T extends { name: string }>(rows: T[]): T[] {
      return narrowRows(rows, self.rowNarrowing)
    },
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
    /**
     * #getter
     * The color each value of the config's `rows.color` field takes,
     * listed pairs first and then in the order dealt.
     */
    get dealtValueColors(): ReadonlyMap<string, string> {
      return self.dealtValueColorsFor(self.rowColorSetting)
    },
  }
}

/** The fifth stage: each row's color. */
export function resolvedRowColorViews<S extends RowSource>(
  self: RowOrderHost<S>,
) {
  return {
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
  }
}

/** The sixth stage: the arranged rows and what their key reads. */
export function editableRowViews<S extends RowSource>(self: RowColorsHost<S>) {
  return {
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
  }
}

/** The seventh stage: the rows narrowed, and the row color key. */
export function clusterableRowViews<S extends RowSource>(
  self: EditableRowsHost<S>,
) {
  return {
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
  }
}

/** The eighth stage: the narrowed rows stacked in bands. */
export function bandedRowViews<S extends RowSource>(
  self: ClusterableRowsHost<S>,
) {
  return {
    /**
     * #getter
     * `bandedSources` and `rowBands`, from one pass over the rows.
     */
    get bandedRows(): { rows: S[]; bands: readonly RowBand[] } {
      const banding = self.rowBanding
      const rows = self.clusterableSources
      return banding
        ? bandRows(rows, row => self.rowBand(row), banding)
        : { rows, bands: [] }
    },
  }
}

/** The ninth stage: the banded rows and their bands. */
export function bandedSourceViews<S extends RowSource>(
  self: BandedRowsHost<S>,
) {
  return {
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
  }
}

/** The last stage: the rows drawn. */
export function sourceViews<S extends RowSource>(self: BandedSourcesHost<S>) {
  return {
    /**
     * #getter
     * Overridable hook: the rows drawn, top to bottom, `bandedSources` by
     * default. MAF drops its hidden reference row.
     */
    get sources(): S[] {
      return self.bandedSources
    },
  }
}

type SourcesHost<S extends RowSource> = BandedSourcesHost<S> &
  ReturnType<typeof sourceViews<S>>

/** Whether the rows drawn are narrowed, which a chip above them says. */
export function rowNarrowingShowsViews<S extends RowSource>(
  self: SourcesHost<S>,
) {
  return {
    /**
     * #getter
     * Whether the "Showing N of M rows" chip shows: something narrows the
     * rows, and the rows are known, so no "0 of 0" shows before the first
     * region lands.
     */
    get rowNarrowingShows(): boolean {
      return narrows(self.rowNarrowing) && self.expandedRows.length > 0
    },
  }
}

/** The line the narrowing chip takes above the rows. */
export function rowFocusLineViews(self: { rowNarrowingShows: boolean }) {
  return {
    /**
     * #getter
     * The line the "Showing N of M rows" chip takes above the first row
     * while `rowNarrowingShows`, 0 otherwise.
     */
    get rowFocusLineHeight(): number {
      return self.rowNarrowingShows ? SIDEBAR_HINT_LINE_PX : 0
    },
  }
}

/** Where the rows start in the display's box. */
export function rowsTopOffsetViews(self: {
  rowsHeaderHeight: number
  rowFocusLineHeight: number
}) {
  return {
    /**
     * #getter
     * Where the rows start in the display's box: under the display's own
     * `rowsHeaderHeight` and the focus chip's line. Every row painter, hit
     * test, label, tree and export places the rows from here.
     */
    get rowsTopOffset(): number {
      return self.rowsHeaderHeight + self.rowFocusLineHeight
    },
  }
}

/** The `rows.axis` toggles the sidebar draws its tree and labels by. */
export function treeSidebarAxisConfigViews(self: TreeSidebarRowsConfigHost) {
  return {
    /**
     * #getter
     * Whether the dendrogram sidebar is drawn.
     */
    get showTree(): boolean {
      return getConf(self, ['rows', 'axis', 'tree'])
    },
    /**
     * #getter
     * Whether the tree draws nodes at their branch length (dendrogram) or
     * evenly by topology (cladogram).
     */
    get showBranchLength(): boolean {
      return getConf(self, ['rows', 'axis', 'branchLength'])
    },
    /**
     * #getter
     * Whether each row's name is drawn over the left of the plot.
     */
    get showRowLabels(): boolean {
      return getConf(self, ['rows', 'axis', 'labels'])
    },
    /**
     * #getter
     * Width in px of the sidebar the dendrogram draws in. On the config
     * rather than the display snapshot for the same reason `height` is: the
     * config node outlives the display instance, so a dragged width survives
     * unticking and reticking the track.
     */
    get treeAreaWidth(): number {
      return getConf(self, ['rows', 'axis', 'width'])
    },
  }
}

/** The tree narrowed to the rows shown. */
export function rowTreeRootViews<S extends RowSource>(self: SourcesHost<S>) {
  return {
    /**
     * #getter
     * The parsed tree narrowed by `rowNarrowing`, a leaf no row has
     * reading as a row with no attributes; none where it keeps no leaf.
     */
    get root(): HierarchyNode<ClusterNodeData> | undefined {
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
  }
}

/** The hooks the dendrogram reads, at what a display that overrides none answers. */
export function treeSidebarTreeHookDefaults(self: {
  root: HierarchyNode<ClusterNodeData> | undefined
}) {
  return {
    /**
     * #getter
     * Overridable hook: the tree `hierarchy` positions, `root` by default.
     * `computeClusterHierarchy` declines to position a tree whose leaves are
     * no longer the rows drawn, so a display that hides a row prunes it from
     * the tree here too, or the whole dendrogram goes with the row.
     */
    get treeRoot(): HierarchyNode<ClusterNodeData> | undefined {
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
  }
}

/** The height the rows stack to. */
export function rowsContentHeightViews(self: {
  sources: readonly unknown[]
  effectiveRowHeight: number
}) {
  return {
    /**
     * #getter
     * The px the rows stack to, `sources` × `effectiveRowHeight`, which the
     * dendrogram's leaves spread over: the content the rows scroll through,
     * never the viewport they scroll inside.
     */
    get rowsContentHeight(): number {
      return self.sources.length * self.effectiveRowHeight
    },
  }
}

/** What {@link hierarchyViews} reads: the tree, the rows and the axis. */
export interface HierarchyHost {
  drawsTree: boolean
  treeRoot: HierarchyNode<ClusterNodeData> | undefined
  sources: readonly { name: string }[]
  rowsContentHeight: number
  treeAreaWidth: number
  showBranchLength: boolean
  rowBands: readonly RowBand[]
}

/** The dendrogram positioned against the rows drawn. */
export function hierarchyViews(self: HierarchyHost) {
  return {
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
            self.rowsContentHeight,
            self.treeAreaWidth,
            self.showBranchLength,
            self.rowBands,
          )
        : undefined
    },
  }
}

/**
 * Whether the names of `order` that `leaves` holds appear in `leaves`' order.
 */
export function listsInOrder(
  leaves: readonly string[],
  order: readonly string[],
) {
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
