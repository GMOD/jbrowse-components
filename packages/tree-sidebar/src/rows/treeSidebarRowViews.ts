import { getConf, isConfigurationModel } from '@jbrowse/core/configuration'
import { annotationPaletteColorAt } from '@jbrowse/core/ui/colors'
import { capitalizeFirst } from '@jbrowse/core/util'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'

import {
  annotationColumn,
  rowAnnotationScales,
} from '../color/rowAnnotations.ts'
import {
  liftRowColor,
  pinnedColorsOf,
  rowAnnotationSettingOf,
  rowColorSettingOf,
} from '../color/rowColorChoice.ts'
import { ROW_COLOR_SCALE_ID, rowColorKeyEntries } from '../color/rowColorKey.ts'
import {
  dealValueColors,
  resolveRowColors,
  withPinnedColors,
  withRowColors,
} from '../color/rowColors.ts'
import { rowColumnLabelsHeight } from '../sidebar/rowLabelsBoxWidth.ts'
import { SIDEBAR_HINT_LINE_PX } from '../sidebar/treeSidebarGeometry.ts'
import { computeClusterHierarchy, getLeafNames } from '../tree/hierarchy.ts'
import { buildTree, treeOfLeaves } from '../tree/newick.ts'
import { arrangeRows, rowAliasOver } from './arrangeRows.ts'
import { bandRows } from './bandRows.ts'
import { narrowRows, narrows } from './narrowRows.ts'
import { rowFieldValue } from './rowFields.ts'

import type { ClusterProvenance } from '../clustering/clusterProvenance.ts'
import type {
  RowAnnotationDeal,
  RowAnnotationDrawn,
  RowAnnotationSetting,
} from '../color/rowAnnotations.ts'
import type { RowColorSnapshot } from '../color/rowColorChoice.ts'
import type { RowColorKeyInputs } from '../color/rowColorKey.ts'
import type { RowColorSetting } from '../color/rowColors.ts'
import type { SvgSidebarProps } from '../sidebar/svgSidebarWidth.ts'
import type { HierarchyNode } from '../tree/hierarchy.ts'
import type {
  ClusterHierarchyNode,
  ClusterNodeData,
  RowAnnotationColumn,
  RowLabelSource,
  RowSource,
} from '../types.ts'
import type { RowAlias, RowParent } from './arrangeRows.ts'
import type { RowBand, RowBanding } from './bandRows.ts'
import type { RowNarrowing } from './narrowRows.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { SvgControlsStrip } from '@jbrowse/display-kit/renderDisplaySvg'
import type { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import type { IModelType, ModelProperties } from '@jbrowse/mobx-state-tree'

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
     * and the rest follow in the order they arrived in.
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
      const kept = getConf(self, ['rows', 'kept'])
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
    /**
     * #getter
     * The `rows.annotations` channels drawn, in the order listed, each read
     * as `rowColorChannel` reads `rows.color`: none where the display's
     * `rows` declares no `annotations` (MAF's), none while the row labels
     * they draw beside are hidden, never one on `name`, which the labels
     * already show, and none on the `rows.color` field, whose column the
     * row color already draws. Each keeps its `position` in the list.
     */
    get rowAnnotationChannels(): RowAnnotationSetting[] {
      const annotations: unknown = Reflect.get(
        self.configuration.rows,
        'annotations',
      )
      return getConf(self, ['rows', 'axis', 'labels']) &&
        Array.isArray(annotations)
        ? annotations
            .flatMap((annotation: unknown, position) =>
              isConfigurationModel(annotation)
                ? [rowAnnotationSettingOf(annotation, position)]
                : [],
            )
            .filter(
              setting =>
                setting.field !== 'name' &&
                setting.field !== this.rowColorChannel.field,
            )
        : []
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
     * refining it. Undefined by default.
     */
    rowParent(_row: S): RowParent | undefined {
      return undefined
    },
    /**
     * #getter
     * Overridable hook: the rows a finer field would draw, each refining a
     * drawn row (`rowParent`), so an order or a focus naming one reaches
     * the row it refines: a sample-mode variant display's haplotype rows.
     * Empty by default.
     */
    get finerRows(): S[] {
      return []
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
     * Overridable hook: whether the display draws the `rows.annotations`
     * columns beside its row labels at all, true by default; off where it
     * names no row, as a one-row wiggle track does. The columns, their
     * labels' lines and their keys all read it, through
     * `rowAnnotationColumns`.
     */
    get drawsRowAnnotations(): boolean {
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
     * #getter
     * Overridable hook: the px at the foot of `rowsHeaderHeight`, directly
     * above the focus chip's line, holding only controls, which an export
     * leaves out with that line. 0 by default.
     */
    get rowsHeaderControlsHeight(): number {
      return 0
    },
    /**
     * #method
     * Overridable hook: the values of the row field `field` the config
     * declares, which the palette deals first, in this order, whether or
     * not a loaded row carries them, so a row arriving later moves no
     * color. Empty by default.
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

type ArrangementInputsHost<S extends RowSource> = TreeSidebarRowInputs<S> &
  ReturnType<typeof rowArrangementInputViews<S>>
type ArrangedRowsHost<S extends RowSource> = ArrangementInputsHost<S> &
  ReturnType<typeof arrangedRowViews<S>>
type BandedRowsHost<S extends RowSource> = ArrangedRowsHost<S> &
  ReturnType<typeof bandedRowViews<S>>

/**
 * What arranging the rows reads, off the hooks and the config alone: the rows
 * at the granularity drawn and the names they answer to, the trees and the
 * order they give, the band a row stacks in, and the color deals. A layer of
 * its own because `rowAlias`, `rowOrder` and `rowBand` are hooks, which the
 * layers after it read through `self`.
 */
export function rowArrangementInputViews<S extends RowSource>(
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
     * Overridable hook: the name each row also answers to, read off
     * `rowParent`: a refining row its parent's, and a `finerRows` row the
     * drawn row it refines. Undefined while no row refines another. MAF
     * reads it off a copy row's name instead, since a copy exists at some
     * loci only and a stored name must answer where no block aligns it.
     */
    get rowAlias(): RowAlias | undefined {
      return rowAliasOver(this.expandedRows, self.finerRows, row =>
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
      const rows = this.expandedRows
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
     * `guideTreeNewick` parsed and rotated towards `rows.sort`; undefined
     * while the display supplies none.
     */
    get guideTree(): HierarchyNode<ClusterNodeData> | undefined {
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
      return !!guideTree && listsInOrder(getLeafNames(guideTree), self.rowSort)
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
        (this.guideTreeHonoursDomain ? self.guideTreeNewick : undefined)
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
        const forks = this.rowForks
        return buildTree(
          tree,
          self.rowTreeProvenance ? [] : self.rowSort,
          forks.size > 0 ? leaf => forks.get(leaf) : undefined,
        )
      }
      return this.guideTreeHonoursDomain ? this.guideTree : undefined
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
      const { parsedTree } = this
      const { rowSort, rowTreeProvenance } = self
      return parsedTree && !rowTreeProvenance
        ? [...getLeafNames(parsedTree), ...rowSort]
        : rowSort
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
    /**
     * #getter
     * The field that colors the rows, or '' for `name`.
     */
    get rowColorField(): string {
      const { field } = this.rowColorSetting
      return field === 'name' ? '' : field
    },
    /**
     * #getter
     * What names the row color: the title of its key and the label over
     * its column, the `rows.color` field or `rowNoun` under `name`.
     */
    get rowColorTitle(): string {
      const field = this.rowColorField
      return field ? capitalizeFirst(field) : self.rowNoun
    },
    /**
     * #getter
     * The rows the palette deals over: `expandedRows`, in the order their
     * source lists them, so no `rows.sort` (the config's or a reorder's),
     * focus or relabel recolors a row, and a tables export deals the same.
     */
    get rowColorDealRows(): readonly S[] {
      return this.expandedRows
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
        () => this.rowColorDealRows,
        this.rowPaletteDeals,
        self.rowColorDeclaredValues(lifted.field),
      )
    },
    /**
     * #getter
     * The color each value of the config's `rows.color` field takes,
     * listed pairs first and then in the order dealt.
     */
    get dealtValueColors(): ReadonlyMap<string, string> {
      return this.dealtValueColorsFor(this.rowColorSetting)
    },
    /**
     * #getter
     * Each `rows.annotations` entry with the color each value of its field
     * takes, dealt as `dealtValueColors` is over the rows in source order,
     * the empty value taking none, from the palette its place in
     * `rows.annotations` picks (`annotationPaletteColorAt`), so no two
     * columns and no column and the row color start on one color. None in
     * a shared panel, which stacks no rows to draw a column beside.
     */
    get rowAnnotationDeals(): RowAnnotationDeal[] {
      return self.sharesPanel
        ? []
        : self.rowAnnotationChannels.map(setting => ({
            setting,
            dealt: dealValueColors(
              setting,
              () => this.rowColorDealRows,
              this.rowPaletteDeals,
              self.rowColorDeclaredValues(setting.field),
              position => annotationPaletteColorAt(setting.position, position),
            ),
          }))
    },
  }
}

/**
 * The rows arranged, colored and narrowed, the row color's key, and the tree
 * narrowed as the rows are, with the tree's hooks. A layer of its own because
 * `clusterableSources` is a hook, which banding reads through `self`.
 */
export function arrangedRowViews<S extends RowSource>(
  self: ArrangementInputsHost<S>,
) {
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
     * #method
     * `rows` narrowed by `rowNarrowing`: `filter`, then `kept`.
     */
    narrowRows<T extends { name: string }>(rows: T[]): T[] {
      return narrowRows(rows, this.rowNarrowing)
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
        this.resolvedRowColors,
      )
    },
    /**
     * #getter
     * Overridable hook: `editableSources` narrowed to the focus, the rows a
     * clustering run clusters, and deliberately not the display's decorated
     * `sources`, whose palette and band a run has no business writing back.
     * MAF applies a focus as given on a track that discovers its species.
     */
    get clusterableSources(): S[] {
      return this.narrowRows(this.editableSources)
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
        resolved: this.resolvedRowColors,
        pinned: self.rowColorPins,
        alias: self.rowAlias,
      }
    },
    /**
     * #getter
     * The row color's key: one scale titled by the `rows.color` field, or
     * none where it has no entries. Its entries (`rowColorKeyEntries`) show
     * where the labels cannot name the colors: by a field, where a row
     * `rows.colors` pins takes an entry by its label, or by name in a
     * shared panel. By name on stacked rows the labels are the key.
     */
    get rowColorKeyScales(): CategoricalScale[] {
      const field = self.rowColorField
      const keyedLabels = () => {
        const labels = new Map(
          this.editableSources.map(row => [row.name, row.label ?? row.name]),
        )
        return rowColorKeyEntries(
          self.rowColorDealRows,
          this.rowColorKeyInputs,
          name => labels.get(name) ?? name,
        )
      }
      const entries = field || self.sharesPanel ? keyedLabels() : []
      const rowKey: CategoricalScale = {
        kind: 'categorical',
        id: ROW_COLOR_SCALE_ID,
        title: self.rowColorTitle,
        focusesRows: true,
        entries,
      }
      return entries.length > 0 ? [rowKey] : []
    },
    /**
     * #getter
     * Whether the "Showing N of M rows" chip shows: something narrows the
     * rows, and the rows are known, so no "0 of 0" shows before the first
     * region lands.
     */
    get rowNarrowingShows(): boolean {
      return narrows(this.rowNarrowing) && self.expandedRows.length > 0
    },
    /**
     * #getter
     * The line the "Showing N of M rows" chip takes above the first row
     * while `rowNarrowingShows`, 0 otherwise.
     */
    get rowFocusLineHeight(): number {
      return this.rowNarrowingShows ? SIDEBAR_HINT_LINE_PX : 0
    },
    /**
     * #getter
     * The parsed tree narrowed by `rowNarrowing`, a leaf no row has
     * reading as a row with no attributes; none where it keeps no leaf.
     */
    get root(): HierarchyNode<ClusterNodeData> | undefined {
      const tree = self.parsedTree
      const narrowing = this.rowNarrowing
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
     * Overridable hook: the tree `hierarchy` positions, `root` by default.
     * `computeClusterHierarchy` declines to position a tree whose leaves are
     * no longer the rows drawn, so a display that hides a row prunes it from
     * the tree here too, or the whole dendrogram goes with the row.
     */
    get treeRoot(): HierarchyNode<ClusterNodeData> | undefined {
      return this.root
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

/**
 * The narrowed rows stacked in bands, and the rows drawn. A layer of its own
 * because `sources` is a hook, which the drawn-row layer reads through `self`.
 */
export function bandedRowViews<S extends RowSource>(self: ArrangedRowsHost<S>) {
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
    /**
     * #getter
     * `clusterableSources` stacked in bands by `rowBanding`, each band's rows
     * in their arranged order: the rows each display paints its palette
     * over. `clusterableSources` itself while nothing bands.
     */
    get bandedSources(): S[] {
      return this.bandedRows.rows
    },
    /**
     * #getter
     * Each band's value, label and the rows it spans in `bandedSources`;
     * none while nothing bands.
     */
    get rowBands(): readonly RowBand[] {
      return this.bandedRows.bands
    },
    /**
     * #getter
     * Overridable hook: the rows drawn, top to bottom, `bandedSources` by
     * default. MAF drops its hidden reference row.
     */
    get sources(): S[] {
      return this.bandedSources
    },
  }
}

/**
 * What reads the rows drawn: the `rows.annotations` columns beside them, the
 * row color keys, the labels over the color columns, and where the rows
 * start in the display's box.
 */
export function drawnRowViews<S extends RowSource>(self: BandedRowsHost<S>) {
  return {
    /**
     * #getter
     * The one decision of which `rows.annotations` columns draw: each
     * entry dealt that colors one of the rows drawn (`sources`, after
     * `filter` and `kept`), while `drawsRowAnnotations`, with each drawn
     * row's color by name. The columns, the labels' lines above them and
     * the keys all read it, so none draws without the others.
     */
    get rowAnnotationColumns(): RowAnnotationDrawn[] {
      return self.drawsRowAnnotations
        ? self.rowAnnotationDeals.flatMap(deal => {
            const colors = annotationColumn(self.sources, deal)
            return colors.size > 0 ? [{ ...deal, colors }] : []
          })
        : []
    },
    /**
     * #getter
     * The color columns the sidebar draws beside the row labels, one per
     * `rowAnnotationColumns` entry, each a row's color by name.
     */
    get rowAnnotationColors(): RowAnnotationColumn[] {
      return this.rowAnnotationColumns.map(column => column.colors)
    },
    /**
     * #getter
     * The row color keys, which every display spreads into its
     * `colorScales`: the row color's (`rowColorKeyScales`), then one per
     * `rowAnnotationColumns` entry, titled as its column is labelled and
     * listing only the values the rows drawn carry, since its entries
     * focus nothing.
     */
    get rowColorScales(): CategoricalScale[] {
      return [
        ...self.rowColorKeyScales,
        ...rowAnnotationScales(self.sources, this.rowAnnotationColumns),
      ]
    },
    /**
     * #getter
     * The label over each color column beside the row labels, the row
     * color's first where a row has one and then each annotation's, each
     * the title of its key. None under two columns, where the one key's
     * title names the one column.
     */
    get rowColumnLabels(): string[] {
      const titles = [
        ...(self.sources.some(source => source.rowColor)
          ? [self.rowColorTitle]
          : []),
        ...this.rowAnnotationColumns.map(column => column.setting.title),
      ]
      return titles.length > 1 ? titles : []
    },
    /**
     * #getter
     * The lines the sidebar stacks directly above the first row: the focus
     * chip's line, then a line per `rowColumnLabels` entry.
     */
    get rowsLeadHeight(): number {
      return (
        self.rowFocusLineHeight + rowColumnLabelsHeight(this.rowColumnLabels)
      )
    },
    /**
     * #getter
     * Where the rows start in the display's box: under the display's own
     * `rowsHeaderHeight` and `rowsLeadHeight`. Every row painter, hit
     * test, label, tree and export places the rows from here.
     */
    get rowsTopOffset(): number {
      return self.rowsHeaderHeight + this.rowsLeadHeight
    },
    /**
     * #getter
     * The lines above the rows that hold only controls, which the SVG
     * export leaves out: `rowsHeaderControlsHeight` and the focus chip's
     * line, directly above the column labels' lines, which it keeps.
     */
    get svgControlsStrip(): SvgControlsStrip {
      const height = self.rowsHeaderControlsHeight + self.rowFocusLineHeight
      return {
        top: self.rowsHeaderHeight - self.rowsHeaderControlsHeight,
        height,
      }
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

/** What {@link rowSidebarViews} reads: the rows, their tree and their colors. */
export interface RowSidebarHost {
  showTree: boolean
  hierarchy: ClusterHierarchyNode | undefined
  sources: RowLabelSource[]
  effectiveRowHeight: number
  treeAreaWidth: number
  showRowLabels: boolean
  rowBands: readonly RowBand[]
  rowAnnotationColors: readonly RowAnnotationColumn[]
  rowColumnLabels: readonly string[]
}

/** The sidebar drawn beside the rows. */
export function rowSidebarViews(self: RowSidebarHost) {
  return {
    /**
     * #getter
     * What the sidebar draws left of the rows, from the settings and the
     * rows drawn: the dendrogram, the band strip, the row labels, the
     * `rows.annotations` columns and the columns' labels. A display's `svgSidebar` is this, or a
     * spread of it with what that display changes, so the screen, the axis
     * past the panel and the export size and draw one sidebar.
     */
    get rowSidebarProps(): SvgSidebarProps {
      return {
        showTree: self.showTree,
        hierarchy: self.hierarchy,
        sources: self.sources,
        rowHeight: self.effectiveRowHeight,
        treeAreaWidth: self.treeAreaWidth,
        showLabels: self.showRowLabels,
        bands: self.rowBands,
        annotations: self.rowAnnotationColors,
        columnLabels: self.rowColumnLabels,
      }
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

/**
 * Installs the row chain on `model` in its one order: the hook defaults, then
 * one layer per hook a later layer reads (`rowArrangementInputViews` declares
 * `rowAlias`, `rowOrder` and `rowBand`, `arrangedRowViews`
 * `clusterableSources`, `treeRoot` and `drawsTree`, `bandedRowViews`
 * `sources`), then `drawnRowViews`. `TreeSidebarMixin` and each static host
 * call it after the row config views, and install their hook overrides after
 * it.
 */
export function treeSidebarRowStages<S extends RowSource>() {
  return <
    P extends ModelProperties,
    O extends ReturnType<typeof treeSidebarRowsConfigViews>,
    C,
    Sn,
  >(
    model: IModelType<P, O, C, Sn>,
  ) =>
    model
      .views(() => treeSidebarRowHookDefaults<S>())
      .views(self => rowArrangementInputViews<S>(self))
      .views(self => arrangedRowViews<S>(self))
      .views(self => bandedRowViews<S>(self))
      .views(self => drawnRowViews<S>(self))
}
