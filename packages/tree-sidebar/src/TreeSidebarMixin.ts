import { getConf, setConf } from '@jbrowse/core/configuration'
import { capitalizeFirst, getContainingTrack } from '@jbrowse/core/util'
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { ROW_ARRANGEMENT_MEMBERS } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { getSnapshot, hasParent, types } from '@jbrowse/mobx-state-tree'
import { compareStructural } from 'mobx'

import { arrangeRows, bandRows, orderRowsByDomain } from './arrangeRows.ts'
import {
  applySubtreeFilter,
  buildTree,
  getLeafNames,
  keptRows,
  matchBandClades,
} from './clusterUtils.ts'
import { focusRows } from './focusRows.ts'
import { maxNodeHeight } from './hierarchy.ts'
import {
  liftRowColor,
  rowColorChoiceOf,
  rowColorMembers,
  rowColorResetTarget,
  sameRowColor,
  startingRowColor,
} from './rowColorChoice.ts'
import {
  ROW_COLOR_SCALE_ID,
  dealtValueColors,
  resolveRowColors,
  rowColorKeyEntries,
  rowColorKeyValue,
  rowFieldValue,
  withRowColors,
} from './rowColorScale.ts'
import { labelEdits } from './rowEdits.ts'
import { IDENTITY_FIELDS, extraColumns } from './sourcesGridUtils.ts'
import { svgSidebarWidth } from './svgSidebarWidth.ts'
import { SIDEBAR_HINT_LINE_PX } from './treeSidebarGeometry.ts'

import type {
  RowAlias,
  RowBand,
  RowBanding,
  UnlistedRowsSort,
} from './arrangeRows.ts'
import type { ClusterProvenance } from './clusterProvenance.ts'
import type { RowColorSnapshot } from './rowColorChoice.ts'
import type { RowColorKeyInputs, RowColorSetting } from './rowColorScale.ts'
import type { RowSortSpec } from './rowSortAutorun.ts'
import type { SvgSidebarProps } from './svgSidebarWidth.ts'
import type { TreeSidebarConfigModel } from './treeSidebarConfigSchemaFields.ts'
import type { HoveredTreeNode, RowSource } from './types.ts'
import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

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

// A row's name, label and colours are what a row colour is set on, never what
// one is set by.
const NOT_COLOUR_FIELDS = new Set<string>([
  ...IDENTITY_FIELDS,
  'id',
  'label',
  'color',
  'rowColor',
])

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

function baseArrangement(self: object): Arrangement {
  return (baseDisplayConfig(self).rows as Arrangement | undefined) ?? {}
}

function liveArrangement(self: object): Arrangement {
  return getSnapshot(confNode(self).configuration.rows) as Arrangement
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
 * #crossCuttingMixin Row set with a dendrogram sidebar, its arrangement the display's `rows` config object and its row colours the `rowColor` object, each written as a session edit to the track's config so undo, reset and a share link reach it and it survives unticking the track. Brings the sidebar toggles, the `runClustering` / `clusterRegion` and `sortRowsBy` declarative launch specs `setupTreeSidebarAutoruns` consumes, the row arrangement every shared consumer goes through, the rows derived from it (`editableSources`, `clusterableSources`) with the arrangement dialog's `applyRowEdits`, the `root` getter, and the tree-hover and canvas-ref volatiles the shared sidebar draws through. A display supplies `discoveredRows`, and `guideTreeNewick` where its adapter carries a tree, and overrides the hooks its rows need
 *
 * The rows are derived in stages, each a computed of its own: the display's
 * `discoveredRows`, then `expandedRows` (`expandRows`: a variant display's
 * haplotypes), then `editableSources`, ordered by `rowOrder`, relabelled by
 * `rows.labels` and each carrying its resolved `rowColor`, then
 * `clusterableSources`, narrowed to the focus, then `bandedSources`, stacked
 * in the bands `rowBanding` names.
 *
 * A row's colour is `resolvedRowColors`: its `rowColor` entry (a `name` pair,
 * or the colour `dealtRowColors` deals its attribute value), else its own
 * `color`, else the row palette's colour by name where `rowPaletteDeals`. The
 * sidebar draws it as a bar beside the row's label, and a display paints its
 * marks in it where `rowColorPaintsMarks`. Its key is `rowColorScales`, and a
 * click on an entry focuses that entry's rows (`focusLegendEntry`).
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
       * `name` where it names none, and the values given a colour of their
       * own.
       */
      get rowColorSetting(): RowColorSetting {
        return liftRowColor({
          field: getConf(confNode(self), ['rowColor', 'field']),
          domain: getConf(confNode(self), ['rowColor', 'domain']),
          range: getConf(confNode(self), ['rowColor', 'range']),
          unknown: getConf(confNode(self), ['rowColor', 'unknown']),
        })
      },
      /**
       * #getter
       * The `rowColor` object this display's base declares, which a reset
       * returns to and "is this the reader's" compares against.
       */
      get baseRowColor(): RowColorSetting {
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
       * Overridable hook: the guide tree the display's adapter supplies, as
       * newick, which `rowTree` draws while some rotation of it lists
       * `rows.domain`. It never enters `rows.tree`, since the adapter
       * re-supplies it on every load. None by default.
       */
      get guideTreeNewick(): string | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable hook: the name a row also answers to, for a display whose
       * rows stand for something named by another name (a variant display's
       * haplotype rows, each answering to its sample). An order, a label, a
       * colour and a focus written against the alias reach every row answering
       * to it. None by default.
       */
      get rowAlias(): RowAlias | undefined {
        return undefined
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
       * Overridable hook: the attribute the rows stack in bands by and the
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
       * The line the "Showing N rows" chip takes above the first row while
       * `rows.kept` narrows the rows, 0 while every row shows.
       */
      get rowFocusLineHeight(): number {
        return self.rowFocus ? SIDEBAR_HINT_LINE_PX : 0
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
       * `guideTreeNewick` parsed and rotated towards `rows.domain`; undefined
       * while the display supplies none.
       */
      get guideTree() {
        const newick = self.guideTreeNewick
        return newick ? buildTree(newick, self.rowDomain) : undefined
      },
      /**
       * #getter
       * Whether the rotated guide tree lists `rows.domain`'s names in
       * `rows.domain`'s order, which holds exactly when some rotation of it
       * does.
       */
      get guideTreeHonoursDomain(): boolean {
        const { guideTree } = this
        return (
          !!guideTree && listsInOrder(getLeafNames(guideTree), self.rowDomain)
        )
      },
      /**
       * #getter
       * The tree the rows are arranged by, as newick: `rows.tree`, else the
       * guide tree while `guideTreeHonoursDomain`. A reorder no rotation
       * produces hides the guide tree, and a reset brings it back.
       */
      get rowTree(): string | undefined {
        return (
          getConf(confNode(self), ['rows', 'tree']) ??
          (this.guideTreeHonoursDomain ? self.guideTreeNewick : undefined)
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * Overridable hook: the band a row stacks in while `rowBanding` is set,
       * by default its value of the banding attribute, '' for none.
       */
      rowBand(row: S): string {
        const banding = self.rowBanding
        return banding ? rowFieldValue(row, banding.field) : ''
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
       * Overridable hook: whether the rows share one panel, so nothing but
       * colour tells them apart. False by default.
       */
      get sharesPanel(): boolean {
        return false
      },
      /**
       * #getter
       * Overridable hook: whether a row's colour paints its data marks, which
       * holds while nothing else colours them. True by default.
       */
      get rowColorPaintsMarks(): boolean {
        return true
      },
      /**
       * #getter
       * Overridable hook: what one row is called, which titles the row colour
       * key where it lists the rows by name in a shared panel. "Row" by
       * default, which only a display of its own that shares a panel would
       * show; a wiggle overlay's rows are subtracks.
       */
      get rowNoun(): string {
        return 'Row'
      },
      /**
       * #getter
       * Overridable hook: the row fields that are a display's own plumbing,
       * which the arrangement dialog never lists as a column.
       */
      get internalRowFields(): readonly string[] {
        return []
      },
      /**
       * #getter
       * Overridable hook: the row attributes a reader can colour the rows by,
       * offered beside None and Each row. By default every attribute a row
       * carries but its name, label and colours.
       */
      get rowColorFields(): readonly string[] {
        return extraColumns(self.expandedRows, NOT_COLOUR_FIELDS)
      },
      /**
       * #getter
       * A line for the corner notice when rows have arrived and none carries
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
       * Whether the palette deals each row a colour by name: only where the
       * rows share one panel and their colour paints the marks.
       */
      get rowPaletteDeals(): boolean {
        return self.sharesPanel && self.rowColorPaintsMarks
      },
      /**
       * #getter
       * The rows the palette deals over: `expandedRows` in the base
       * arrangement, so no reorder, focus or relabel recolours a row.
       */
      get rowColorDealRows(): readonly S[] {
        return orderRowsByDomain(
          self.expandedRows,
          self.baseRowDomain,
          self.rowAlias,
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * The colour each value takes under `setting` (`dealtValueColors`),
       * which the arrangement dialog shows before it writes the setting.
       */
      dealtRowColorsFor(
        setting: RowColorSnapshot,
      ): ReadonlyMap<string, string> {
        return dealtValueColors(
          liftRowColor(setting),
          () => self.rowColorDealRows,
          self.rowPaletteDeals,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether `rowColor` gives its field's values colours the config does
       * not, so "Reset row order" is offered for a recolour too: whether
       * `rowColorResetTarget` has anything to write. What the rows are
       * coloured by is no arrangement, so picking it is never custom.
       */
      get rowStylingIsCustom(): boolean {
        return (
          rowColorResetTarget(
            self.rowColorSetting,
            self.baseRowColor,
            self.rowPaletteDeals,
          ) !== undefined
        )
      },
      /**
       * #getter
       * What the rows are coloured by, as the arrangement dialog and a menu
       * offer it: '' for none dealt, `name` for a palette colour each, or an
       * attribute.
       */
      get rowColorChoice(): string {
        return rowColorChoiceOf(self.rowColorSetting, self.rowPaletteDeals)
      },
      /**
       * #method
       * The `rowColor` object `choice` starts from (`startingRowColor`): the
       * current object's where it shows that choice, else the config's.
       */
      rowColorFor(choice: string): RowColorSetting {
        return startingRowColor(
          choice,
          [self.rowColorSetting, self.baseRowColor],
          self.rowPaletteDeals,
        )
      },
      /**
       * #getter
       * The attribute the rows are coloured by, or '' by `name`.
       */
      get rowColorAttribute(): string {
        const { field } = self.rowColorSetting
        return field === 'name' ? '' : field
      },
      /**
       * #getter
       * The colour each value of the config's `rowColor` field takes, listed
       * pairs first and then in the order dealt.
       */
      get dealtRowColors(): ReadonlyMap<string, string> {
        return self.dealtRowColorsFor(self.rowColorSetting)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The attributes a reader can colour the rows by: `rowColorFields`, and
       * the current one where the rows lack it, so it still shows as chosen.
       */
      get rowColorAttributesOffered(): readonly string[] {
        const current = self.rowColorChoice
        return current === '' ||
          current === 'name' ||
          self.rowColorFields.includes(current)
          ? self.rowColorFields
          : [...self.rowColorFields, current]
      },
      /**
       * #getter
       * Each row's colour, by name: its `rowColor` entry, else its own
       * `color`, else the palette's where `rowPaletteDeals`. The one answer
       * every display paints a row's colour from.
       */
      get resolvedRowColors(): ReadonlyMap<string, string> {
        return resolveRowColors(
          self.expandedRows,
          self.rowColorSetting.field,
          self.dealtRowColors,
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
          self.rowStylingIsCustom ||
          ORDER_MEMBERS.some(
            member =>
              !compareStructural(present(live[member]), present(base[member])),
          )
        )
      },
      /**
       * #getter
       * The rows in the reader's arrangement, each with its resolved
       * `rowColor`, and with no focus or band: the list the arrangement dialog
       * edits, so a submit writes back only what the reader chose.
       * `expandedRows` itself while nothing is arranged or coloured.
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
       * What the row colour key and its focus read of the colours.
       */
      get rowColorKeyInputs(): RowColorKeyInputs {
        const setting = self.rowColorSetting
        return {
          setting,
          pairs: pairedColorsOf(setting),
          dealt: self.dealtRowColors,
          resolved: self.resolvedRowColors,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The row colour key, which every display spreads into its
       * `colorScales`: one scale titled by the `rowColor` field, or none
       * where it has no entries. Its entries (`rowColorKeyEntries`) show
       * where the labels cannot name the colours: by an attribute, or by
       * name in a shared panel. By name on stacked rows the labels are the
       * key.
       */
      get rowColorScales(): CategoricalScale[] {
        const attribute = self.rowColorAttribute
        if (!attribute && !self.sharesPanel) {
          return []
        }
        const labels = new Map(
          attribute
            ? []
            : self.editableSources.map(row => [
                row.name,
                row.label ?? row.name,
              ]),
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
                title: attribute ? capitalizeFirst(attribute) : self.rowNoun,
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
        return keptRows(self.editableSources, self.rowFocus, self.rowAlias)
      },
      /**
       * #getter
       * `rowTree` parsed. A run rotated its tree in the same write as the
       * order it produced; a tree that arrived as data rotates towards
       * `rows.domain` here, and the guide tree is `guideTree`'s parse.
       */
      get parsedTree() {
        const tree: string | undefined = getConf(confNode(self), [
          'rows',
          'tree',
        ])
        if (tree) {
          return buildTree(tree, self.rowTreeProvenance ? [] : self.rowDomain)
        }
        return self.guideTreeHonoursDomain ? self.guideTree : undefined
      },
      /**
       * #method
       * Whether the arrangement dialog's submit of `next` drops the tree: an
       * order that moves no row is not written, so it drops nothing, and the
       * guide tree drops only for an order no rotation of it lists.
       */
      rowOrderWillDropTree(next: readonly { name: string }[]) {
        const order = orderOver(self.rowDomain, next)
        const guide = self.guideTreeNewick
        return guide &&
          !getConf(confNode(self), ['rows', 'tree']) &&
          self.guideTreeHonoursDomain
          ? !listsInOrder(getLeafNames(buildTree(guide, order)), order)
          : !movesNoRow(next, self.editableSources) &&
              orderDropsTree(self.rowTree, self.rowDomain, order)
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
      function writeRowColor(setting: RowColorSetting) {
        setConf(confNode(self), 'rowColor', rowColorMembers(setting))
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
         * carrying the label the reader left on it, and the `rowColor` object
         * the dialog shows, written where it differs from the config's. The
         * labels go to `rows` by the rule `labelEdits` states, and the order
         * to `rows.domain` unless it moves no row, so a submit that changes
         * nothing writes nothing.
         */
        applyRowEdits(rows: readonly S[], rowColor?: RowColorSnapshot) {
          if (rowColor) {
            const next = liftRowColor(rowColor)
            if (!sameRowColor(next, self.rowColorSetting)) {
              writeRowColor(next)
            }
          }
          write(
            'labels',
            labelEdits({
              rows,
              shown: self.editableSources,
              adapter: self.expandedRows,
              labels: self.rowLabels,
              rowAlias: self.rowAlias,
            }),
          )
          if (!movesNoRow(rows, self.editableSources)) {
            writeOrder(rows)
          }
          persist()
        },
        /**
         * #action
         * Return every arrangement member — order, labels, tree, provenance
         * and focus — to what the config declares, leaving `rows.field`, and
         * the `rowColor` colours to `rowColorResetTarget`: the config's for
         * the choice, which stays.
         */
        resetRowArrangement() {
          const base = baseArrangement(self)
          for (const member of ROW_ARRANGEMENT_MEMBERS) {
            write(member, base[member])
          }
          const target = rowColorResetTarget(
            self.rowColorSetting,
            self.baseRowColor,
            self.rowPaletteDeals,
          )
          if (target) {
            writeRowColor(target)
          }
          persist()
        },
        /**
         * #action
         * Colour the rows by `choice`, as a menu picks it: '' for None,
         * `name` for Each row, or an attribute, starting from `rowColorFor`.
         * A pick of the current choice writes nothing.
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
       * `LegendHost`'s hook: a click on a row colour key entry narrows the
       * rows to those it lists. Every other scale's entries name colours, not
       * rows, and stay inert.
       */
      focusLegendEntry(scaleId: string, value: string) {
        const key = self.rowColorKeyInputs
        const names =
          scaleId === ROW_COLOR_SCALE_ID
            ? self.editableSources
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
