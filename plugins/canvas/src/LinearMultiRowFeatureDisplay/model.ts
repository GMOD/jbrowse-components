import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { legendIsReadable } from '@jbrowse/core/ui'
import {
  assembleLocString,
  getSession,
  notifyFeatureDetailsMiss,
  openFeatureWidget,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { copyText } from '@jbrowse/core/util/copyText'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import {
  LegendMixin,
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import {
  installPerRegionLifecycle,
  regionDataMap,
} from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  filterRowsBySubtree,
  loadedRegionIndexAt,
  reconcileLayout,
  resetRowOrderMenuItems,
  rowLabelsCarryText,
  setupRowSortAutorun,
  setupRunClusteringAutorun,
  setupTreeDrawingAutorun,
  treeDescribesRows,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from '@jbrowse/tree-sidebar'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import CanvasFeatureGateMixin from '../shared/CanvasFeatureGateMixin.ts'
import { fetchCanvasFeatureDetails } from '../shared/fetchCanvasFeatureDetails.ts'
import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'
import { blockScreenRect } from './rendering/blockScreenRect.ts'
import {
  buildColorLegend,
  resolveConfiguredLegend,
} from './rendering/colorLegend.ts'
import {
  drawnFeatureContext,
  drawnFeaturesByRow,
  findTopDrawnFeatureInRow,
} from './rendering/featurePainting.ts'
import { buildMultiRowInstanceBuffer } from './rendering/multiRowInstanceBuffer.ts'
import { rowOrderByValueAt } from './rowOrderByValueAt.ts'
import {
  applyRowGroups,
  orderPartitionValues,
  resolveRowColors,
} from './sourcesLogic.ts'
import { buildMultiRowTrackMenuItems } from './trackMenuItems.ts'

import type {
  LinearMultiRowFeatureDisplayConfig,
  LinearMultiRowFeatureDisplayConfigModel,
} from './configSchema.ts'
import type { DrawnFeaturesByRow } from './rendering/featurePainting.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowRenderingBackend,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource, RowGroup } from './sourcesLogic.ts'
import type { LegendItem, MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { RowSortSpec } from '@jbrowse/tree-sidebar'
import type React from 'react'

export interface MultiRowHit {
  // adapter feature id + the region it was found in, so a click can re-fetch
  // the full feature for the details widget
  id: string
  regionIndex: number
  // display row the feature paints on. The row's label is NOT carried alongside
  // it: a hit outlives a row reorder, so a snapshot of both can disagree —
  // consumers resolve the label through `sources[rowIndex]`.
  rowIndex: number
  name: string
  refName: string
  start: number
  end: number
}

/**
 * #stateModel LinearMultiRowFeatureDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * Multi-row interval painter (chromosome / ancestry painting). Partitions a
 * single feature track into stacked rows by a feature attribute and paints each
 * feature as a colored block on its row. GPU-rendered (WebGL/Canvas2D
 * fallback) via the shared per-region lifecycle. Rows are a `sources` chain
 * (discovered → layout-reconciled → subtree-filtered) and the left sidebar
 * (labels + dendrogram + reorder) is the shared `TreeSidebarMixin`.
 */
export default function stateModelFactory(
  configSchema: LinearMultiRowFeatureDisplayConfigModel,
) {
  return types
    .compose(
      'LinearMultiRowFeatureDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      CanvasFeatureGateMixin(),
      LegendMixin(),
      RowHeightMixin(),
      TreeSidebarMixin<MultiRowSource>(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMultiRowFeatureDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        // `runClustering` / `clusterRegion` are TreeSidebarMixin's — they
        // trigger a run whose output is that mixin's state.
        /**
         * #property
         * Transient declarative launch spec (like `runClustering`): set
         * `{refName, pos}` to sort the rows once by the value each carries at
         * that genomic position — the in-app, session-expressible equivalent of a
         * hand-computed `rowOrder`. tree-sidebar's `setupRowSortAutorun` applies
         * it (once the region is loaded) and clears it, so the resulting
         * `layout` persists but the trigger never re-fires.
         */
        // #region frozenProp
        // `RowSortSpec`, not a second spelling of it: the autorun that consumes
        // this and `setSortRowsBy` are both typed on tree-sidebar's, so an
        // inline shape here is a copy that can only ever drift away from the one
        // doing the checking. Multi-wiggle's twin already reads it from there.
        sortRowsBy: types.maybe(types.frozen<RowSortSpec>()),
        // #endregion
        /**
         * #property
         * Legend categories toggled off (by label). Features painted in a hidden
         * category's color are dropped from both render paths and the hit-test.
         * See `hiddenColors` / `toggleCategory`.
         */
        hiddenCategories: types.array(types.string),
      }),
    )
    .volatile(() => ({
      // #region volatile
      rpcDataMap: regionDataMap<MultiRowRegionData>(),
      prefersOffset: true,
      /**
       * #volatile
       * The feature under the mouse, or undefined when not hovering a block. Pure
       * hover identity — the cursor position that places the tooltip is component
       * state, so moving inside one block doesn't invalidate this.
       *
       * Named apart from the `hoveredFeature` getter it fills, because
       * `BaseDisplay` declares that hook as a computed and MST refuses to
       * instantiate a volatile over one.
       */
      hoveredMultiRowFeature: undefined as MultiRowHit | undefined,
      /**
       * #volatile
       * Right-click context menu anchor + the genomic position clicked (and the
       * feature there, if any). Undefined when the menu is closed.
       */
      contextMenuInfo: undefined as
        | {
            clientX: number
            clientY: number
            refName: string
            pos: number
            hit?: MultiRowHit
          }
        | undefined,
      // #endregion
    }))
    .views(self => ({
      /**
       * #getter
       * Fills `BaseDisplay`'s cross-display hover hook, which the view reads to
       * publish `session.hovered`.
       */
      get hoveredFeature() {
        return self.hoveredMultiRowFeature
      },
      /**
       * #getter
       * config typed off the concrete schema (ConfigurationReference erases it
       * to any); direct reads route through here to stay typed
       */
      get conf(): LinearMultiRowFeatureDisplayConfig {
        return self.configuration
      },
      /**
       * #getter
       * Multi-row paints features into fixed lanes, so a high total feature count
       * (e.g. a whole-chromosome haplotype painting with many segments per row)
       * is not a per-glyph render cost — only the byte/download budget should
       * gate it. Disable the density axis of CanvasFeatureGateMixin so the
       * "too many features" banner never shows here.
       */
      get densityGateEnabled() {
        return false
      },
      /**
       * #getter
       */
      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The `partitionField` slot — an attribute name, or a `jexl:` expression —
       * forwarded to the worker, which binds `feature` and resolves it per
       * feature (`makeFeaturePartitionResolver`).
       *
       * Reads the raw slot value, not `readConfObject`/`getConf`: this is a
       * transport read, and the resolving readers evaluate a callback against
       * whatever context the call passes, which here is none. The rmsk recipe
       * this slot documents resolved that way to `''` — `feature.name` is
       * `undefined` and `split` is total — and `''` shipped to the worker as an
       * attribute name, so every feature answered `feature.get('')` and the
       * track drew one unnamed row, with nothing thrown anywhere. Pinned
       * end-to-end by partitionFieldTransport.test.ts.
       */
      get partitionField(): string {
        return self.conf.partitionField
      },
      /**
       * #getter
       * Feature attribute holding a signed bp length change vs the reference.
       * Empty = the indel-glyph pass is off. A fetch input: it decides whether
       * the worker packs `featureDeltas` at all.
       */
      get lengthField(): string {
        return readConfObject(self.conf, 'lengthField')
      },
      /**
       * #getter
       * Optional explicit row order from config; values listed here are placed
       * first, remaining discovered values follow in sorted order.
       */
      get rowOrder(): string[] {
        return readConfObject(self.conf, 'rowOrder')
      },
      /**
       * #getter
       * Raw `color` slot (a CSS color or `jexl:` string, or undefined when
       * unset), forwarded to the worker which resolves it per feature.
       */
      get colorConfig(): string | undefined {
        return self.conf.color
      },
      /**
       * #getter
       * Map of partition value → color, forwarded to the worker which applies it
       * over the per-feature `color`.
       */
      get sampleColorMap(): Record<string, string> {
        return readConfObject(self.conf, 'sampleColorMap')
      },
      /**
       * #getter
       */
      get rowProportion(): number {
        return readConfObject(self.conf, 'rowProportion')
      },
      /**
       * #getter
       * Regex-to-group entries tagging rows with a sidebar swatch color. Applied
       * in `sources`, downstream of `layout`, so the derived color never lands in
       * persisted state — a `rowGroups` edit then takes effect on a session that
       * already has a clustered layout, instead of losing to the stale copy.
       */
      get rowGroups(): RowGroup[] {
        return readConfObject(self.conf, 'rowGroups')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Rows discovered in the loaded data: the distinct partition values across
       * all loaded regions, ordered by the config `rowOrder` then sorted. The
       * pre-layout, pre-filter input to the arrangement dialog and to clustering.
       */
      get sourcesWithoutLayout(): MultiRowSource[] {
        const values = new Set<string>()
        for (const data of self.rpcDataMap.values()) {
          for (const v of data.partitionValues) {
            values.add(v)
          }
        }
        return orderPartitionValues(values, self.rowOrder).map(name => ({
          name,
        }))
      },
      /**
       * #getter
       * Whether the loaded data colored itself via `itemRgb` (only possible with
       * the `color` slot at its default). Suppresses the per-row palette, which
       * would otherwise paint over those colors.
       */
      get usedItemRgb(): boolean {
        return [...self.rpcDataMap.values()].some(data => data.usedItemRgb)
      },
      /**
       * #getter
       * The attribute names the loaded features carry, which is what the
       * "Partition by..." menu offers. Unioned across regions and re-sorted,
       * since two regions can be served by adapters that saw different optional
       * columns.
       *
       * Empty until something is loaded, which is the menu's own disabled
       * condition — the names are discovered from the data rather than declared,
       * the same way the rows themselves are.
       */
      get partitionCandidates(): string[] {
        const names = new Set<string>()
        for (const data of self.rpcDataMap.values()) {
          for (const name of data.partitionCandidates) {
            names.add(name)
          }
        }
        return [...names].sort()
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Discovered rows with the user's arrangement (reorder/relabel) applied —
       * what the arrangement dialog edits. Not subtree-filtered.
       */
      get editableSources(): MultiRowSource[] {
        return reconcileLayout(self.sourcesWithoutLayout, self.layout)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The display rows: `editableSources` narrowed by the active subtree
       * filter. Render order, label order, and `rowIndexByValue` all key off
       * this, so reordering/filtering flows through to the painting.
       *
       * `rowGroups` decorates them here, and **partitions them into blocks only
       * when no cluster tree already names this order**. Grouping and ordering
       * are two questions about one axis, and a config carrying both used to
       * resolve them by having `rowGroups` win and the dendrogram vanish behind
       * `StaleTreeHint` — a silent trade of the tree for a stripe. A clustered
       * track is exactly where the stripe is worth most: it is the axis the
       * clustering did NOT see, so reading it across the blocks the tree found
       * is what says whether they correspond.
       */
      get sources(): MultiRowSource[] {
        const rows = filterRowsBySubtree(
          self.editableSources,
          self.subtreeFilter,
        )
        return applyRowGroups(rows, self.rowGroups, {
          partition: !(self.root && treeDescribesRows(self.root, rows)),
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rowIndexByValue(): Map<string, number> {
        return new Map(self.sources.map((s, i) => [s.name, i] as const))
      },
      /**
       * #getter
       * Per-row color (ABGR) by display row — the single per-row resolver
       * (dialog color > config `sampleColorMap` > palette-when-default). Applied
       * at render time over the worker-baked per-feature `color` slot, so any
       * color change repaints without a refetch.
       */
      get rowColorsByIndex(): (number | undefined)[] {
        // Resolved over the unfiltered rows, then read back per display row: the
        // fallback palette indexes by row position, so resolving over the
        // filtered list would recolor every surviving row when the user focuses
        // a clade in the tree (filterRowsBySubtree is hide-only).
        const colors = resolveRowColors(
          self.editableSources,
          self.sampleColorMap,
          self.colorConfig === undefined && !self.usedItemRgb,
        )
        const byName = new Map(
          self.editableSources.map((s, i) => [s.name, colors[i]] as const),
        )
        return self.sources.map(s => byName.get(s.name))
      },
      /**
       * #getter
       * Number of displayed rows (at least 1, so the auto-fit division is safe
       * and the canvas mounts before data arrives).
       */
      get nrow(): number {
        return Math.max(1, self.sources.length)
      },
      /**
       * #getter
       * The track height that auto-fit mode divides among rows: the `height`
       * config slot (its default, or a drag-resized value written to it).
       */
      get fitTargetHeight(): number {
        return readConfObject(self.conf, 'height')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Categorical color key. The explicit `legend` config slot wins when set
       * (for color-encoded categories with no feature attribute to key on, e.g.
       * an itemRgb ancestry painting); otherwise it's auto-derived from the
       * loaded data as distinct `(featureName -> per-feature color)` pairs among
       * per-feature-colored rows. Empty in per-row palette / sampleColorMap mode
       * (where the sidebar labels are the key) and for non-categorical (unnamed /
       * all-distinct) data. See resolveConfiguredLegend / buildColorLegend.
       */
      get colorLegend() {
        const configured = resolveConfiguredLegend(
          readConfObject(self.conf, 'legend'),
        )
        return configured.length
          ? configured
          : buildColorLegend(
              self.rpcDataMap.values(),
              self.rowIndexByValue,
              self.rowColorsByIndex,
            )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `hiddenCategories` as a Set, and the single place "is this category
       * hidden?" is answered: the on-screen and SVG-export legends (dimmed rows),
       * `hiddenColors`, and the track menu's category checkboxes all read it.
       * One derivation rather than four, so a change to how a label is matched
       * can't reach some of the legends and miss the rest.
       */
      get hiddenCategorySet(): ReadonlySet<string> {
        return new Set(self.hiddenCategories)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * ABGR colors currently hidden via the legend's category toggles: the
       * `colorLegend` colors whose label is in `hiddenCategories`. Both render
       * paths and the hit-test skip features painted in one of these, so toggling
       * a category off drops it everywhere without a refetch. `colorLegend` has
       * one entry per distinct color (see buildColorLegend), so each toggle maps
       * to exactly one color.
       */
      get hiddenColors(): ReadonlySet<number> {
        if (!self.hiddenCategories.length) {
          return new Set<number>()
        }
        const hidden = self.hiddenCategorySet
        return new Set(
          self.colorLegend.filter(e => hidden.has(e.label)).map(e => e.color),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The auto-fit row height: the display height split evenly across rows,
       * so all rows stay visible as the row count grows.
       *
       * Not floored at a pixel: a display given thousands of rows would
       * otherwise stop fitting and grow to a pixel a row instead, which is a
       * track thousands of pixels tall rather than the dense overview asked
       * for. The floor lives in `rowBand`, where a sub-pixel row is widened for
       * drawing without changing how many rows fit.
       */
      get autoRowHeight(): number {
        return self.fitTargetHeight / self.nrow
      },
      /**
       * #getter
       * Ceiling on the whole row stack in CSS px, because this display sizes its
       * canvas to its *content* and never scrolls: `height` is the canvas, so
       * nothing downstream bounds it. What goes wrong past it, and why it is a
       * function rather than a constant, is `maxCanvasCssPx`'s. A fixed 14px
       * row height over a 1,987-row cohort — two clicks in the Row height menu
       * — is 27,818 CSS px, well past it.
       *
       * MAF meets the same limit with `maxRowsHeight`, but its canvas is a
       * viewport it can scroll the overflow into. Here the cap has to land on
       * the row height instead (below), so the rows thin out and every one of
       * them stays on screen — which is what this display is for.
       */
      get maxCanvasHeight(): number {
        return maxCanvasCssPx()
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The one override of `RowHeightMixin`'s resolved height, and the reason
       * is structural: this display sizes its canvas to its *content* instead
       * of scrolling a viewport, so nothing downstream bounds the row stack and
       * the cap has to land here. `maxCanvasHeight / nrow` is that cap; past it
       * the rows thin out and every one of them stays on screen, which is what
       * this display is for.
       *
       * The sentinel resolution and the non-positive floor stay the mixin's
       * `resolveRowHeight` — `featureAt` and `rowBand` divide by this, so a
       * `height` slot configured to 0 must not reach them as a 0.
       *
       * The cap is not floored back up afterwards: a row below a pixel is
       * legitimate here (see `autoRowHeight`), and `rowBand` is where a
       * sub-pixel row is widened for drawing without changing how many of them
       * fit.
       */
      get effectiveRowHeight(): number {
        return Math.min(
          resolveRowHeight(self.rowHeight, self.autoRowHeight),
          self.maxCanvasHeight / self.nrow,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Key for the `rowGroups` stripe: one row per (group, color) pair present,
       * in first-appearance order, in the color the sidebar swatch is painted.
       *
       * **Empty unless that stripe is the only thing carrying row identity.**
       * Above `rowLabelsCarryText` the sidebar writes each row's name beside it
       * and a key would restate them. Below it `RowLabelsOverlay` drops to an
       * unlabelled swatch, and 1,987 canids at 0.32 px a row are then five
       * group colors with nothing saying what any of them is — the same hole
       * multi-wiggle's key closed, on the display whose figure the swatch
       * stripe was built for.
       *
       * A different vocabulary from `colorLegend`, which keys the per-feature
       * painting and drives the category toggles; these rows name rows, and are
       * not toggleable. `legendIsReadable` refuses the degenerate cases — one
       * group, or more groups than a reader can scan.
       *
       * `showRowLabels` gates it too, because that toggle takes the stripe with
       * it rather than only the text: `RowLabelsOverlay` renders no
       * `SvgRowLabels` at all when it is off, and `SvgRowLabels` is where the
       * swatch runs are drawn. Without this the labels-off dense case published
       * a "Row groups" key naming colors that appear nowhere on the plot — the
       * exact inverse of the case above, from the same one-line question asked
       * about only half of what draws the stripe.
       */
      get rowGroupLegend(): LegendItem[] {
        if (
          !self.showRowLabels ||
          rowLabelsCarryText(self.effectiveRowHeight)
        ) {
          return []
        }
        const seen = new Set<string>()
        const items: LegendItem[] = []
        for (const { group, labelColor } of self.sources) {
          if (group !== undefined && labelColor !== undefined) {
            const key = `${group} ${labelColor}`
            if (!seen.has(key)) {
              seen.add(key)
              items.push({ color: labelColor, label: group })
            }
          }
        }
        return legendIsReadable(items) ? items : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Override BaseLinearDisplay.height so the track container matches the
       * rendering canvas (numRows × effectiveRowHeight). In auto-fit mode this
       * resolves to `fitTargetHeight`; in fixed mode it grows with the row
       * count — this display grows to its content rather than scrolling a
       * fixed viewport, which is why a fixed-mode drag re-pins the row height
       * (see `setHeight`) instead of leaving it alone the way the scrolling row
       * displays do.
       *
       * Bounded by `maxCanvasHeight` through `effectiveRowHeight`, so growing
       * to the content stops at the canvas limit rather than at nothing. A drag
       * past it therefore returns 0 from `resizeHeight` and simply stalls.
       */
      get height(): number {
        return self.nrow * self.effectiveRowHeight
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Positioned dendrogram (when a cluster tree exists and describes the
       * rows on screen). Leaves spaced over `height`, branches over
       * `treeAreaWidth`.
       *
       * Passes the *drawn* row names, which is the backstop for anything that
       * reorders `sources` downstream of `layout` where `setLayout`'s
       * invalidation cannot see it: such a reorder drops the dendrogram rather
       * than drawing it against rows it does not name. `rowGroups` used to be
       * the way to reach that state, and no longer is — it declines to partition
       * while a tree describes the rows (see `sources`), so the two now compose
       * instead of one silently costing the other.
       */
      get hierarchy() {
        return computeClusterHierarchy(
          self.root,
          self.sources,
          self.height,
          self.treeAreaWidth,
          self.showBranchLength,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Pixel width reserved on the left for the tree (0 when no tree shows).
       */
      get sidebarOffset(): number {
        return treeSidebarOffset(self)
      },
      /**
       * #getter
       */
      get spatialIndex() {
        return buildSpatialIndex(self.hierarchy)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The three inputs to "does this feature paint, and in what color" —
       * `featurePainting`'s whole contract, and nothing else.
       *
       * Split out of `renderState` because the two have different lifetimes and
       * the difference is expensive. `renderState` also carries the canvas box
       * and the row geometry, all four of which move on a track-height drag or
       * a window resize; this moves only on a reorder, a recolor, a category
       * toggle or a refetch. The consumers that answer the paint question and
       * nothing else — the per-region GPU encode autorun and the hit test's
       * memoized contexts — read this, so a resize no longer re-encodes every
       * region's instance buffer (a full pass over every feature, per drag
       * frame) to arrive at byte-identical output.
       */
      get featurePaintInputs(): Pick<
        MultiRowRenderState,
        'rowIndexByValue' | 'rowColorsByIndex' | 'hiddenColors'
      > {
        return {
          rowIndexByValue: self.rowIndexByValue,
          rowColorsByIndex: self.rowColorsByIndex,
          hiddenColors: self.hiddenColors,
        }
      },
      /**
       * #getter
       * Render state passed to the GPU/Canvas2D backend each frame.
       */
      get renderState(): MultiRowRenderState {
        return {
          // the mixin's resolved canvas box — see `canvasWidthPx` for why this
          // is not `view.width` and what SVG export does instead
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          rowHeight: self.effectiveRowHeight,
          rowProportion: self.rowProportion,
          ...this.featurePaintInputs,
        }
      },
      /**
       * #getter
       * Per-region data for the indel-glyph overlay, or undefined when the
       * `lengthField` slot is unset and there is no glyph pass.
       *
       * A computed returning a plain `Map` rather than `rpcDataMap` itself: the
       * overlay draws inside an effect, so nothing it touches there is tracked,
       * and handing it the ObservableMap would mean a refetch never redrew the
       * glyphs. Rebuilding here makes the read happen where MobX sees it and
       * gives the overlay a value whose identity changes exactly when the data
       * does.
       */
      get indelGlyphRegions() {
        return self.lengthField
          ? new Map<number, MultiRowRegionData>(self.rpcDataMap.entries())
          : undefined
      },
      /**
       * #method
       * Fetch-input cache keys (tier-1, via SettingsInvalidate → refetch).
       * Color is resolved in the worker, so the raw color slot is a key.
       */
      rpcProps() {
        return {
          partitionField: self.partitionField,
          lengthField: self.lengthField,
          colorConfig: self.colorConfig,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Per-region drawn features bucketed by display row, keyed by
       * displayedRegionIndex. Built through `forEachDrawnFeature` off the same
       * `featurePaintInputs` the painters use, so the hit test cannot answer "is
       * this feature drawn" differently from the paint that put it there.
       *
       * Memoized because the hit test needs it per *pointer frame*: `featureAt`
       * runs on every rAF-coalesced mouse move, and building it inline meant
       * resolving the region's whole partition list (a couple of thousand rows
       * on a cohort painting) sixty times a second for a value that changes
       * only when the rows, the colors or the data do.
       *
       * Bucketing rather than a bare context, because the memo only removed the
       * *setup* from the pointer frame and left the scan: the row is known
       * before the search starts, so a hit on a 200-feature row was still
       * walking the region's other half-million. See `findTopDrawnFeatureInRow`.
       *
       * `featurePaintInputs` rather than the whole `renderState`, so that
       * "changes only when the rows, the colors or the data do" is actually
       * true — see there.
       */
      get drawnFeaturesByRow(): Map<number, DrawnFeaturesByRow> {
        const state = self.featurePaintInputs
        const rowCount = self.sources.length
        return new Map(
          [...self.rpcDataMap.entries()].map(([index, data]) => [
            index,
            drawnFeaturesByRow(
              data,
              drawnFeatureContext(data, state),
              rowCount,
            ),
          ]),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * Hit-test the feature under a display-relative pixel: row from
       * `mouseY / rowHeight`, genomic bp from the view, then the first feature on
       * that row whose `[start,end)` covers the bp. Returns undefined over the
       * sidebar, off-row, out-of-bounds, or over a gap.
       *
       * The sidebar bound is `treeSidebarRightEdge`, not `sidebarOffset`: the
       * latter is where labels are *drawn* from, while the resize handle sitting
       * in the 4px past it is the sidebar's interactive edge, and a hit under the
       * handle would fight the drag. Same bound the wiggle family hit-tests
       * against, and the same one the crosshair's guide stops at.
       */
      featureAt(mouseX: number, mouseY: number): MultiRowHit | undefined {
        if (mouseX < treeSidebarRightEdge(self)) {
          return undefined
        }
        const targetRow = Math.floor(mouseY / self.effectiveRowHeight)
        if (!self.sources[targetRow]) {
          return undefined
        }
        const view = self.lgv
        const p = view.pxToBp(mouseX)
        if (p.oob) {
          return undefined
        }
        const region = self.rpcDataMap.get(p.index)
        if (!region) {
          return undefined
        }
        const byRow = self.drawnFeaturesByRow.get(p.index)
        if (!byRow) {
          return undefined
        }
        // the base drawn under the cursor, which the containment test compares
        // against; coord0 names the one to its right when reversed
        const bp = basePaintedAt(p, p.offset)
        const { featureStarts, featureEnds, featureNames, featureIds } = region
        // `findTopDrawnFeatureInRow` owns both halves of "which feature is
        // under this pixel" that the painters also own: which features are
        // drawn at all, and which of two overlapping ones is on top. All this
        // adds is the span.
        const i = findTopDrawnFeatureInRow(
          byRow,
          targetRow,
          i => featureStarts[i]! <= bp && bp < featureEnds[i]!,
        )
        return i === -1
          ? undefined
          : {
              id: featureIds[i]!,
              regionIndex: p.index,
              rowIndex: targetRow,
              name: featureNames[i]!,
              refName: p.refName,
              start: featureStarts[i]!,
              end: featureEnds[i]!,
            }
      },
    }))
    .views(self => ({
      /**
       * #method
       * What a right-click at this display-relative pixel resolves to: the
       * genomic position the menu's position-scoped rows act on ("Sort rows by
       * color here"), and the feature there when the click landed on one.
       *
       * Undefined wherever no menu should open, which is what the component
       * needs in order to decide whether to `preventDefault` — over the tree
       * sidebar, which overlays this display and owns its own menu, and in the
       * inter-region gutter, where there is no base to name. Model-side and
       * beside `featureAt` because it is the same question about the same pixel;
       * spelled out in the component it re-derived `pxToBp`, the sidebar bound
       * and the painted base that `featureAt` was about to derive again.
       */
      contextTargetAt(mouseX: number, mouseY: number) {
        if (mouseX < treeSidebarRightEdge(self)) {
          return undefined
        }
        const p = self.lgv.pxToBp(mouseX)
        if (p.oob) {
          return undefined
        }
        return {
          refName: p.refName,
          // anchors "sort rows by color here" on the clicked column, so it must
          // be the base drawn there (coord0 is off by one when reversed)
          pos: basePaintedAt(p, p.offset),
          hit: self.featureAt(mouseX, mouseY),
        }
      },

      /**
       * #getter
       * Screen box of the block to mark, or undefined when there's nothing to
       * mark. The hover drops when a right-click menu opens (else its tooltip
       * sticks under the menu), so the menu's own feature stands in — the block a
       * menu is acting on is exactly the one that should stay marked.
       */
      get highlightedBlockRect() {
        const hit = self.hoveredFeature ?? self.contextMenuInfo?.hit
        return hit
          ? blockScreenRect({
              hit,
              blocks: self.renderBlocks,
              rowHeight: self.effectiveRowHeight,
              rowProportion: self.rowProportion,
            })
          : undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setShowRowSeparators(f: boolean) {
        setConf(self, 'showRowSeparators', f)
      },
      /**
       * #action
       * Show/hide a legend category by label (render-time, no refetch).
       */
      toggleCategory(label: string) {
        const next = self.hiddenCategories.includes(label)
          ? self.hiddenCategories.filter(l => l !== label)
          : [...self.hiddenCategories, label]
        self.hiddenCategories.replace(next)
      },
      /**
       * #action
       */
      setHiddenCategories(labels: string[]) {
        self.hiddenCategories.replace(labels)
      },
      /**
       * #action
       * Repartition: which feature attribute assigns a feature to a row.
       *
       * A fetch input, so writing the slot refetches on its own — nothing here
       * has to ask for one. What it DOES have to do is drop the state keyed on
       * the old rows: `layout` names rows by value, so under a new partition its
       * entries name rows that no longer exist, and `getSources` appends a row a
       * layout omits rather than dropping it — the old row set would have come
       * back beside the new one, empty, with a saved color each. Same for the
       * hidden categories, whose labels are the old values.
       *
       * `clearLayout`, not `setLayout([])`, because the subtree filter is keyed
       * on row names too. It is otherwise independent of the tree and of the
       * order — `filterRowsBySubtree` matches on `name` and needs neither, so
       * `setLayout` deliberately keeps a focused clade across a reorder — but
       * this is the one action here that renames the rows out from under it.
       * Left set, it matched nothing and `sources` came back empty: a blank
       * canvas with no row labels, recoverable only by finding "Clear subtree
       * filter" in the track menu. `setPhasedMode` is the same action on the
       * multi-sample variant displays and clears it for the same reason.
       */
      setPartitionField(field: string) {
        if (field === self.partitionField) {
          return
        }
        setConf(self, 'partitionField', field)
        self.clearLayout()
        self.hiddenCategories.clear()
      },
      /**
       * #action
       * Trigger (or clear) a one-shot declarative row sort; consumed and reset
       * by `setupRowSortAutorun`. The right-click menu calls `sortRowsByValueAt`
       * directly (instant, data already loaded); this prop is the session-level
       * entry point.
       */
      setSortRowsBy(arg?: RowSortSpec) {
        self.sortRowsBy = arg
      },
      /**
       * #action
       * Reorder the rows by the value each carries at (refName, pos) — the
       * feature covering that position on each row. Reads the already-loaded
       * region data (no refetch/RPC) and writes the new order via `layout`.
       *
       * Declines with fewer than two rows to order, because the empty result is
       * not a harmless no-op: `setLayout` clears the cluster tree whenever the
       * row set changes, so writing it discards both the saved arrangement and
       * the dendrogram a clustering run produced. The rows are DISCOVERED from
       * `rpcDataMap` (see `sourcesWithoutLayout`), which empties whenever the
       * display is panned off its data or blanked by the density gate — so
       * "sorting" a track that is merely not loaded right now used to wipe it.
       * `sortRowsBy`, the declarative twin, meets the same condition by waiting
       * for the region instead (see setupRowSortAutorun); a click has nothing to
       * wait for, so it declines.
       *
       * Declines again when no loaded region covers the column, which is the
       * gate `setupRowSortAutorun` and multi-wiggle's twin already applied and
       * this did not: it filtered the regions by refName alone, so a position
       * past the end of the loaded window gave every row "no value" and wrote
       * back the order it already had. `loadedRegionIndexAt` is the one
       * predicate all three now ask, and resolving to a single region is also
       * what stops two loaded windows on one contig from both answering.
       */
      sortRowsByValueAt(refName: string, pos: number) {
        const index = loadedRegionIndexAt(self.loadedRegions, refName, pos)
        const region =
          index === undefined ? undefined : self.rpcDataMap.get(index)
        if (!region || self.editableSources.length < 2) {
          return
        }
        // editableSources, not `sources`: layout-merged (so a user's colors
        // survive the reorder) and unfiltered by the subtree, so a focused
        // clade doesn't persist itself as the whole row order and drop
        // everything it was hiding.
        self.setLayout(rowOrderByValueAt(self.editableSources, region, pos))
      },
      /**
       * #action
       */
      openContextMenu(info: NonNullable<typeof self.contextMenuInfo>) {
        self.contextMenuInfo = info
      },
      /**
       * #action
       */
      closeContextMenu() {
        self.contextMenuInfo = undefined
      },
      /**
       * #action
       * Writes only when the hovered block actually changes, so a mouse moving
       * within one block (blocks are many px wide) doesn't invalidate the
       * observers watching this.
       */
      setHoveredFeature(arg?: MultiRowHit) {
        const cur = self.hoveredMultiRowFeature
        if (arg?.id !== cur?.id || arg?.regionIndex !== cur?.regionIndex) {
          self.hoveredMultiRowFeature = arg
        }
      },
      /**
       * #action
       * Re-fetch the full clicked feature by id and open it in the feature
       * details widget. The painting ships only the slim render arrays, so the
       * complete feature is fetched on demand (GetCanvasFeatureDetails).
       */
      selectFeatureById(featureId: string, displayedRegionIndex: number) {
        const region = self.loadedRegions.get(displayedRegionIndex)
        if (!region) {
          // The click landed on a region whose data has already gone, which is
          // the same nothing-to-open the lookup itself reports below.
          notifyFeatureDetailsMiss(self)
          return
        }
        void withFeatureDetails(
          self,
          () =>
            fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfig,
              featureId,
              region,
            ),
          feature => {
            openFeatureWidget(self, feature.toJSON(), { feature })
          },
        )
      },
      /**
       * #action
       */
      setRpcData(regionIndex: number, data: MultiRowRegionData) {
        self.rpcDataMap.set(regionIndex, data)
      },
      /**
       * #action
       */
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
      /**
       * #action
       * Set the track height. In auto-fit mode the rows restretch to it; in fixed
       * mode it's distributed across the current rows as a fixed row height.
       */
      // Both branches floor the TRACK at MIN_DISPLAY_HEIGHT, never the row.
      // Flooring the row instead (`Math.max(1, newHeight / nrow)`) got both ends
      // wrong at once: on a 1,987-row painting it stalled a shrink drag at 1,987
      // px — a height auto-fit reaches freely, since `autoRowHeight` is
      // deliberately not floored and `rowBand` widens a sub-pixel row to
      // MIN_DRAWN_ROW_PX for drawing — while on a 3-row one it let the same drag
      // collapse the track to 3 px, past the point where its own resize handle
      // can be grabbed again. A sub-pixel row is legitimate here (see
      // `autoRowHeight` and `resolveRowHeight`, which passes one through and
      // floors only a non-positive); a sub-MIN_DISPLAY_HEIGHT track is not, in
      // either mode.
      setHeight(newHeight: number) {
        const clamped = Math.max(newHeight, MIN_DISPLAY_HEIGHT)
        if (self.rowHeight === 0) {
          setConf(self, 'height', clamped)
        } else {
          setConf(self, 'rowHeight', clamped / self.nrow)
        }
        return self.height
      },
      /**
       * #action
       * Drag-resize. Defers to `setHeight`, which restretches rows in auto-fit
       * mode and re-pins the row height in fixed mode.
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        self.setHeight(self.height + distance)
        return self.height - oldHeight
      },
      /**
       * #action
       * Switch to auto-fit: seed the `height` config slot from the current
       * content height (so toggling on doesn't jump), then `rowHeight = 0`
       * makes `effectiveRowHeight` derive from it.
       */
      setFitToHeight() {
        setConf(self, 'height', Math.max(self.height, MIN_DISPLAY_HEIGHT))
        setConf(self, 'rowHeight', 0)
        self.scrollTop = 0
      },
      /**
       * #action
       */
      startRenderingBackend(backend: MultiRowRenderingBackend) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          regionData => {
            // read here, inside the per-region encode autorun, so a reorder /
            // recolor / category toggle re-encodes without an RPC roundtrip.
            //
            // `featurePaintInputs`, never `renderState`: the encode is tracked,
            // and the instance buffer holds {startBp,endBp,rowIndex,color} with
            // no geometry in it — the row height and canvas box reach the shader
            // as uniforms. Reading the wider getter here made a track-height
            // drag or a window resize re-encode every region, every frame, to
            // produce the same bytes.
            const { buffer } = buildMultiRowInstanceBuffer(
              regionData,
              self.featurePaintInputs,
            )
            return { instanceBuffer: buffer }
          },
          b =>
            b.renderBlocks(
              self.renderBlocks,
              self.rpcDataMap,
              self.renderState,
            ),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * A region is cache-valid only once its features are committed. A too-large
       * region is marked loaded (so the fetch autorun doesn't spin) but stores no
       * rpcData, so this returns false and the region refetches the moment the
       * gate releases (zoom-in or force-load).
       *
       * A view, not an action: as an action MobX untracks the `rpcDataMap` read
       * and `FetchVisibleRegions` keeps a stale answer.
       */
      isCacheValid(displayedRegionIndex: number) {
        return self.rpcDataMap.has(displayedRegionIndex)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      fetchNeeded(needed: { region: Region; displayedRegionIndex: number }[]) {
        return fetchMultiRowFeatures(self, needed)
      },
      /**
       * #action
       */
      async renderSvg(opts: ExportSvgDisplayOptions): Promise<React.ReactNode> {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
    .actions(self => {
      return {
        // No superAfterAttach() call: the fork auto-chains hooks, so
        // MultiRegionDisplayMixin's afterAttach already runs (see
        // afterAttachAutoChain.test.ts). An explicit call would double-install
        // its fetch autoruns.
        /**
         * #action
         * Fills `BaseDisplay`'s hover-clear hook, which the fetch
         * foundation's reaction calls on every viewport change.
         *
         * The painting is a sticky canvas, so a pan or zoom fires no
         * mousemove and no mouseleave and `hoveredFeature` keeps naming
         * whatever used to be under the cursor.
         */
        clearHoveredFeature() {
          self.setHoveredFeature(undefined)
        },

        afterAttach() {
          // The byte/density gate clears its own stale per-region stats on
          // chromosome nav (CanvasFeatureGateMixin.afterAttach) — nothing to
          // wire up here.

          // Clear hover when the viewport moves under a stationary cursor. The
          // painting is a sticky canvas, so a pan or zoom fires no mousemove
          // and no mouseleave and `hoveredFeature` keeps naming whatever used
          // to be under the pointer — the tooltip and `MultiRowHoverHighlight`
          // then describe a block that has scrolled away. The component's
          // handlers cover only the cases where the *pointer* moves.

          // Both are mobx-only glue and the barrel is a static import above, so
          // they install synchronously. The tree drawing one came through
          // `await import('@jbrowse/tree-sidebar')` until it was measured: a
          // dynamic import of a barrel this file already imports statically
          // deferred one 4KB module and dragged the rest of the barrel into an
          // async chunk, +69KB. See packages/tree-sidebar/CLAUDE.md.
          setupRowSortAutorun(self, {
            name: 'MultiRowFeatureSortRows',
            sortRows: (refName, pos) => {
              self.sortRowsByValueAt(refName, pos)
            },
          })
          setupTreeDrawingAutorun(self)

          // The "Cluster rows by similarity" flavor of the shared declarative-
          // clustering autorun: fires once when `runClustering` flips true
          // (from the track menu or a saved session) and runs the real
          // feature-matrix RPC over whatever the installer resolved -- the
          // `clusterRegion` locus if the session named one, the visible blocks
          // if not -- then clears the flag.
          //
          // Installed synchronously; the heavy half is code-split inside `run`,
          // so the clustering module loads when a run actually starts rather
          // than on every attach. This used to be a wrapper module imported for
          // that split, which also carried a hand-written duck type of the six
          // members the installer needs -- three copies of it, one per flavor,
          // now that those members are declared on TreeSidebarMixin.
          setupRunClusteringAutorun(self, {
            name: 'AutoRunMultiRowClustering',
            ready: () => self.sourcesWithoutLayout.length > 1,
            run: async args => {
              const { runMultiRowClustering } =
                await import('./runMultiRowClustering.ts')
              await runMultiRowClustering({ model: self, ...args })
            },
          })
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * Items for the right-click context menu, built from the clicked position
       * (contextMenuInfo). "Sort rows by color here" is the interactive twin of
       * the declarative `sortRowsBy`.
       */
      contextMenuItems(): MenuItem[] {
        const info = self.contextMenuInfo
        if (!info) {
          return []
        }
        const { hit } = info
        return [
          {
            label: 'Sort rows by color here',
            icon: SwapVertIcon,
            // Says so rather than declining silently, and matches the threshold
            // "Cluster rows by similarity" states in the track menu. The rows
            // are discovered from loaded data, so this is the ordinary state of
            // a track panned off its features — not a defensive branch.
            disabled: self.editableSources.length < 2,
            disabledHelpText: 'Needs at least two rows to sort',
            onClick: () => {
              self.sortRowsByValueAt(info.refName, info.pos)
            },
          },
          ...(hit
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.selectFeatureById(hit.id, hit.regionIndex)
                  },
                },
                // The same row the feature display offers, for the same
                // reason: it is the one thing in either menu that gets pasted
                // somewhere rather than read. A row painting is where a reader
                // is most likely to want it, since nothing else here names the
                // block's span.
                {
                  label: 'Copy location',
                  subLabel: 'e.g. to paste into the location search box',
                  icon: ContentCopyIcon,
                  onClick: () => {
                    void copyText(
                      self,
                      assembleLocString({
                        refName: hit.refName,
                        start: hit.start,
                        end: hit.end,
                      }),
                      'location',
                    )
                  },
                },
              ]
            : []),
          // the same item the track menu spreads — one action reachable from
          // two places, so it must not read as two
          ...resetRowOrderMenuItems(self),
        ]
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            ...buildMultiRowTrackMenuItems(self),
          ]
        },
      }
    })
}

type LinearMultiRowFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiRowFeatureDisplayModel =
  Instance<LinearMultiRowFeatureDisplayStateModel>
