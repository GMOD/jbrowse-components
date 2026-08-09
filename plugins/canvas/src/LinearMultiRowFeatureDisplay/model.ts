import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { legendIsReadable } from '@jbrowse/core/ui'
import { getSession, openFeatureWidget } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MIN_DISPLAY_HEIGHT,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  installClearHoverOnViewportChange,
} from '@jbrowse/plugin-linear-genome-view'
import { MAX_CANVAS_DIM_PX, getDpr } from '@jbrowse/render-core/canvas2dUtils'
import {
  installPerRegionLifecycle,
  regionDataMap,
} from '@jbrowse/render-core/installPerRegionLifecycle'
import {
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  filterRowsBySubtree,
  reconcileLayout,
  resetRowOrderMenuItems,
  rowLabelsCarryText,
  setupRowSortAutorun,
  setupRunClusteringAutorun,
  treeSidebarOffset,
  treeSidebarRightEdge,
} from '@jbrowse/tree-sidebar'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { fetchCanvasFeatureDetails } from '../LinearBasicDisplay/baseModelHelpers.ts'
import CanvasFeatureGateMixin from '../shared/CanvasFeatureGateMixin.ts'
import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'
import { blockScreenRect } from './rendering/blockScreenRect.ts'
import {
  buildColorLegend,
  resolveConfiguredLegend,
} from './rendering/colorLegend.ts'
import {
  drawnFeatureContext,
  findTopDrawnFeature,
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
import type { DrawnFeatureContext } from './rendering/featurePainting.ts'
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
        sortRowsBy: types.maybe(
          types.frozen<{ refName: string; pos: number }>(),
        ),
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
       */
      hoveredFeature: undefined as MultiRowHit | undefined,
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
      get showLegend(): boolean {
        return getConf(self, 'showLegend')
      },
      /**
       * #getter
       */
      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },
      /**
       * #getter
       */
      get showRowLabels(): boolean {
        return getConf(self, 'showRowLabels')
      },
      /**
       * #getter
       */
      get showTree(): boolean {
        return getConf(self, 'showTree')
      },
      /**
       * #getter
       */
      get showBranchLength(): boolean {
        return getConf(self, 'showBranchLength')
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get partitionField(): string {
        return readConfObject(self.conf, 'partitionField')
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
       */
      get sources(): MultiRowSource[] {
        return applyRowGroups(
          filterRowsBySubtree(self.editableSources, self.subtreeFilter),
          self.rowGroups,
        )
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
      /**
       * #getter
       * Raw per-row height setting: `0` is auto-fit, any positive value is a
       * pinned px height. The resolved value is `effectiveRowHeight` —
       * consumers read that, never this.
       */
      get rowHeight(): number {
        return readConfObject(self.conf, 'rowHeight')
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
       * nothing downstream bounds it.
       *
       * Past `MAX_CANVAS_DIM_PX` device px the backing store stops tracking the
       * CSS size — `syncCanvasSize` clamps it — while the scissor/viewport rects
       * are still derived as `cssPx * dpr`, so WebGPU rejects an out-of-bounds
       * rect and blanks the frame, WebGL clamps and paints at the wrong scale,
       * and the Canvas2D fallback stretches its top slice over the whole track.
       * A pinned 14px row height over a 1,987-row cohort — two clicks in the Row
       * height menu — is 27,818 CSS px, well past it.
       *
       * MAF meets the same limit with `maxRowsHeight`, but its canvas is a
       * viewport it can scroll the overflow into. Here the cap has to land on
       * the row height instead (below), so the rows thin out and every one of
       * them stays on screen — which is what this display is for.
       */
      get maxCanvasHeight(): number {
        return MAX_CANVAS_DIM_PX / getDpr()
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved per-row height: `rowHeight === 0` auto-fits, any positive
       * value is the pinned px height. Every consumer reads this, never the raw
       * `rowHeight` setting.
       *
       * The sentinel resolution and the non-positive floor are shared with the
       * other sentinel-bearing row displays (`resolveRowHeight`) — `featureAt`
       * and `rowBand` divide by this, so a `height` slot configured to 0 must
       * not reach them as a 0. A genuine sub-pixel fit height passes through;
       * see `autoRowHeight`.
       *
       * Then capped so the stack fits `maxCanvasHeight`. It is not floored back
       * up afterwards: a row below a pixel is legitimate here (see
       * `autoRowHeight`), and `rowBand` is where a sub-pixel row is widened for
       * drawing without changing how many of them fit.
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
       */
      get rowGroupLegend(): LegendItem[] {
        if (rowLabelsCarryText(self.effectiveRowHeight)) {
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
       * Passes the *drawn* row names, so a `rowGroups` partition — which
       * reorders `sources` downstream of `layout`, where `setLayout`'s
       * invalidation can't see it — drops the dendrogram rather than drawing it
       * against the regrouped order. The two orderings genuinely conflict:
       * clustering decides an order and `rowGroups` overrides it.
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
          rowIndexByValue: self.rowIndexByValue,
          rowColorsByIndex: self.rowColorsByIndex,
          hiddenColors: self.hiddenColors,
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
       * Per-region `DrawnFeatureContext`, keyed by displayedRegionIndex — the
       * same thing the painters build per draw, off the same `renderState`, so
       * the hit test cannot answer "is this feature drawn" differently from the
       * paint that put it there.
       *
       * Memoized because the hit test needs it per *pointer frame*: `featureAt`
       * runs on every rAF-coalesced mouse move, and building it inline meant
       * resolving the region's whole partition list (a couple of thousand rows
       * on a cohort painting) sixty times a second for a value that changes
       * only when the rows, the colors or the data do.
       */
      get drawnFeatureContexts(): Map<number, DrawnFeatureContext> {
        const state = self.renderState
        return new Map(
          [...self.rpcDataMap.entries()].map(([index, data]) => [
            index,
            drawnFeatureContext(data, state),
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
        const ctx = self.drawnFeatureContexts.get(p.index)
        if (!ctx) {
          return undefined
        }
        // the base drawn under the cursor, which the containment test compares
        // against; coord0 names the one to its right when reversed
        const bp = basePaintedAt(p, p.offset)
        const { featureStarts, featureEnds, featureNames, featureIds } = region
        // `findTopDrawnFeature` owns both halves of "which feature is under
        // this pixel" that the painters also own: which features are drawn at
        // all, and which of two overlapping ones is on top. All this adds is
        // the row and the span.
        const i = findTopDrawnFeature(
          region,
          ctx,
          (i, rowIndex) =>
            rowIndex === targetRow &&
            featureStarts[i]! <= bp &&
            bp < featureEnds[i]!,
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
      setRowHeight(n: number) {
        setConf(self, 'rowHeight', n)
      },
      /**
       * #action
       */
      setShowLegend(f: boolean) {
        setConf(self, 'showLegend', f)
      },
      /**
       * #action
       */
      setShowRowSeparators(f: boolean) {
        setConf(self, 'showRowSeparators', f)
      },
      /**
       * #action
       */
      setShowRowLabels(f: boolean) {
        setConf(self, 'showRowLabels', f)
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
       */
      setShowTree(f: boolean) {
        setConf(self, 'showTree', f)
      },
      /**
       * #action
       */
      setShowBranchLength(f: boolean) {
        setConf(self, 'showBranchLength', f)
      },
      /**
       * #action
       * Trigger (or clear) a one-shot declarative row sort; consumed and reset
       * by `setupRowSortAutorun`. The right-click menu calls `sortRowsByValueAt`
       * directly (instant, data already loaded); this prop is the session-level
       * entry point.
       */
      setSortRowsBy(arg?: { refName: string; pos: number }) {
        self.sortRowsBy = arg
      },
      /**
       * #action
       * Reorder the rows by the value each carries at (refName, pos) — the
       * feature covering that position on each row. Reads the already-loaded
       * region data (no refetch/RPC) and writes the new order via `layout`.
       */
      sortRowsByValueAt(refName: string, pos: number) {
        const regions = [...self.rpcDataMap.entries()].map(([index, data]) => ({
          ...data,
          refName: self.loadedRegions.get(index)?.refName ?? '',
        }))
        // editableSources, not `sources`: layout-merged (so a user's colors
        // survive the reorder) and unfiltered by the subtree, so a focused
        // clade doesn't persist itself as the whole row order and drop
        // everything it was hiding.
        self.setLayout(
          rowOrderByValueAt(self.editableSources, regions, refName, pos),
        )
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
        const cur = self.hoveredFeature
        if (arg?.id !== cur?.id || arg?.regionIndex !== cur?.regionIndex) {
          self.hoveredFeature = arg
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
        if (region) {
          void (async () => {
            const feature = await fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfig,
              featureId,
              region,
            )
            if (feature && isAlive(self)) {
              openFeatureWidget(self, feature.toJSON())
            }
          })()
        }
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
       * mode it's distributed across the current rows as a pinned row height.
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
            // recolor / category toggle re-encodes without an RPC roundtrip
            const { buffer, count } = buildMultiRowInstanceBuffer(
              regionData,
              self.renderState,
            )
            return { instanceBuffer: buffer, instanceCount: count }
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
        async afterAttach() {
          // The byte/density gate clears its own stale per-region stats on
          // chromosome nav (CanvasFeatureGateMixin.afterAttach) — nothing to
          // wire up here.

          // Clear hover when the viewport moves under a stationary cursor. The
          // painting is a sticky canvas, so a pan or zoom fires no mousemove
          // and no mouseleave and `hoveredFeature` keeps naming whatever used
          // to be under the pointer — the tooltip and `MultiRowHoverHighlight`
          // then describe a block that has scrolled away. The component's
          // handlers cover only the cases where the *pointer* moves.
          addDisposer(
            self,
            installClearHoverOnViewportChange(self, () => {
              self.setHoveredFeature(undefined)
            }),
          )

          // Light autorun (mobx-only, already bundled): install synchronously.
          // The two below genuinely code-split heavy d3/clustering code.
          setupRowSortAutorun(self, {
            name: 'MultiRowFeatureSortRows',
            sortRows: (refName, pos) => {
              self.sortRowsByValueAt(refName, pos)
            },
          })

          try {
            const { setupTreeDrawingAutorun } =
              await import('@jbrowse/tree-sidebar')
            if (isAlive(self)) {
              setupTreeDrawingAutorun(self)
            }
          } catch (e) {
            console.error(e)
          }

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

export type LinearMultiRowFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearMultiRowFeatureDisplayModel =
  Instance<LinearMultiRowFeatureDisplayStateModel>
