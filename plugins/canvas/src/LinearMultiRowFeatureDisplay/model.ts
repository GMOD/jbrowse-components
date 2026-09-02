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
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import {
  ContextMenuMixin,
  RowHeightMixin,
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  filterRowsBySubtree,
  reconcileLayout,
  resetRowOrderMenuItems,
  rowLabelsCarryText,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
  sortRowsHereMenuItem,
  treeDescribesRows,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import DensityBandMixin from '../shared/DensityBandMixin.ts'
import { copyItem } from '../shared/copyMenuItem.ts'
import {
  featureSpanRegion,
  fetchCanvasFeatureDetails,
} from '../shared/fetchCanvasFeatureDetails.ts'
import { createCanvasFeatureDetailsOpener } from '../shared/openCanvasFeatureDetails.ts'
import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'
import {
  contextTargetAtPixel,
  createDrawnFeaturesByRowIndex,
  featureAtPixel,
  hitBlockRect,
  hitRow,
} from './hitTesting.ts'
import {
  answeredPartitionField,
  partitionCandidates,
  partitionRowCounts,
  pinnedPartitionField,
  regionHasPinnedData,
} from './partitionFields.ts'
import {
  buildColorLegend,
  resolveConfiguredLegend,
} from './rendering/colorLegend.ts'
import { buildMultiRowInstanceBuffer } from './rendering/multiRowInstanceBuffer.ts'
import { rowOrderByValueAt } from './rowOrderByValueAt.ts'
import {
  applyRowGroups,
  orderPartitionValues,
  resolveRowColorStrings,
} from './rowSources.ts'
import { buildMultiRowTrackMenuItems } from './trackMenuItems.ts'

import type {
  LinearMultiRowFeatureDisplayConfig,
  LinearMultiRowFeatureDisplayConfigModel,
} from './configSchema.ts'
import type { MultiRowContextMenuInfo, MultiRowHit } from './hitTesting.ts'
import type { PartitionRowCount } from './partitionFields.ts'
import type { DrawnFeaturesByRow } from './rendering/featurePainting.ts'
import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowRenderingBackend,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource, RowGroup } from './rowSources.ts'
import type { LegendItem, MenuItem } from '@jbrowse/core/ui'
import type { Region } from '@jbrowse/core/util'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

const EMPTY_REGION_DATA: ReadonlyMap<number, MultiRowRegionData> = new Map()

// The hit and the right-click target the interaction surface resolves to, and
// the functions that resolve them, live beside the painting they read
// (`hitTesting.ts`). Re-exported because they are this display's vocabulary.
export type { MultiRowContextMenuInfo, MultiRowHit } from './hitTesting.ts'

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
      // After the foundation, whose region-too-large verdict it keys off: where
      // the gate refuses the features, a track with a density sidecar draws
      // features per bin in the banner's place.
      DensityBandMixin(),
      LegendMixin(),
      RowHeightMixin(),
      TreeSidebarMixin<MultiRowSource>(),
      ContextMenuMixin<MultiRowContextMenuInfo>(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMultiRowFeatureDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        // `runClustering` / `clusterRegion` / `sortRowsBy` are
        // TreeSidebarMixin's — they trigger a run whose output is that mixin's
        // state. `sortRowsBy` here is the in-app, session-expressible
        // equivalent of a hand-computed `rowOrder`.
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
      rpcDataMap: regionDataMap<MultiRowRegionData>('rpcDataMap'),
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
      // #endregion
    }))
    .views(self => ({
      /**
       * #getter
       * What the painters, the hit test, the sidebar's rows and the export read:
       * the loaded regions, or nothing while the band stands in for them, so
       * the swap is total and a track forced to `density` over data it already
       * holds draws the band alone.
       */
      get drawnRegionData(): ReadonlyMap<number, MultiRowRegionData> {
        return self.densityBandActive ? EMPTY_REGION_DATA : self.rpcDataMap
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get view() {
        return getContainingView(self) as LinearGenomeViewModel
      },
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
       * The byte-gate opt-in. Multi-row paints features into fixed lanes, so a
       * high total feature count (a whole-chromosome haplotype painting with
       * many segments per row) is not a per-glyph render cost; only the
       * byte/download budget gates it, and the density axis stays at
       * `RegionTooLargeMixin`'s off.
       */
      get gateEnabled() {
        return true
      },
      /**
       * #getter
       */
      get showRowSeparators(): boolean {
        return getConf(self, 'showRowSeparators')
      },
      /**
       * #getter
       * Whether the sidebar label box is tinted with the color its row is
       * painted in — see `labelSources`.
       */
      get colorRowLabels(): boolean {
        return getConf(self, 'colorRowLabels')
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
    .views(self => {
      // A plain getter hands out a fresh array on every write to `rpcDataMap`,
      // and this list reaches `featurePaintInputs` — the identity
      // `stableIdentityComputed` is holding steady, for the same reason as
      // MultiLinearWiggleDisplay's `sourcesWithoutLayout`.
      const sourcesWithoutLayout = stableIdentityComputed(() => {
        const values = new Set<string>()
        for (const data of self.drawnRegionData.values()) {
          for (const v of data.partitionValues) {
            values.add(v)
          }
        }
        return orderPartitionValues(values, self.rowOrder).map(name => ({
          name,
        }))
      })
      return {
        /**
         * #getter
         * Rows discovered in the loaded data: the distinct partition values across
         * all loaded regions, ordered by the config `rowOrder` then sorted. The
         * pre-layout, pre-filter input to the arrangement dialog and to clustering.
         */
        get sourcesWithoutLayout(): MultiRowSource[] {
          return sourcesWithoutLayout.get()
        },
        /**
         * #getter
         * Whether anything is painted right now — no loaded region, an empty
         * contig, or the density band standing in for them all answer no. What
         * the configured `legend` slot is gated on, the way the auto-derived
         * key is gated on the same data by construction.
         */
        get hasDrawnFeatures(): boolean {
          return [...self.drawnRegionData.values()].some(
            data => data.featureIds.length > 0,
          )
        },
        /**
         * #getter
         * Whether the loaded data colored itself via `itemRgb` (only possible with
         * the `color` slot at its default). Suppresses the per-row palette, which
         * would otherwise paint over those colors.
         */
        get usedItemRgb(): boolean {
          return [...self.drawnRegionData.values()].some(
            data => data.usedItemRgb,
          )
        },
        /**
         * #getter
         * The attribute a loaded region actually resolved its rows on, or
         * undefined while none has — the one answer `effectivePartitionField`
         * and `pinnedPartitionField` are two readings of. Which region answers,
         * and why the question is asked of the held payloads rather than the
         * drawn ones, are `partitionFields.ts`.
         */
        get answeredPartitionField(): string | undefined {
          return answeredPartitionField(self)
        },
        /**
         * #getter
         * The attribute the rows are actually partitioned on: the `partitionField`
         * slot, or — with the slot at its empty default — what the worker picked
         * off the columns the data turned out to carry (`resolvePartitionField`,
         * `repClass` on a RepeatMasker file). `name` until something has loaded,
         * which is what auto falls back to anyway.
         *
         * The resolved twin of the `partitionField` transport read above, which
         * stays the raw slot because that is what the fetch has to send — resolve
         * it there and the worker would be handed the main thread's guess at a
         * question only the worker can answer, and the auto pick could never
         * happen. Everything that asks "which attribute are these rows" — the
         * menu's radio, the clustering call that has to land features in the rows
         * the painting drew — reads this one.
         */
        get effectivePartitionField(): string {
          return this.answeredPartitionField ?? 'name'
        },
        /**
         * #getter
         * What a fetch issued NOW should partition on under auto, and what a
         * landed region is CHECKED against (`regionHasData`). Not an
         * `rpcProps()` key: keying on the resolved field would refetch every
         * region the moment the first one answered.
         */
        get pinnedPartitionField(): string {
          return pinnedPartitionField(self)
        },
        /**
         * #getter
         * The attribute names the loaded features carry, which is what the
         * "Partition by..." menu offers. Empty until something is loaded, which
         * is the menu's own disabled condition.
         */
        get partitionCandidates(): string[] {
          return partitionCandidates(self)
        },
        /**
         * #getter
         * How many rows each candidate would draw over the loaded regions, which
         * the "Partition by..." menu puts beside each name so a reader can tell
         * the twenty-row attribute from the one-row-per-feature one before
         * paying the refetch.
         */
        get partitionRowCounts(): ReadonlyMap<string, PartitionRowCount> {
          return partitionRowCounts(self)
        },
      }
    })
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
       * The rows a clustering run acts on: `editableSources` narrowed to the
       * focused clade, and deliberately NOT the decorated `sources` below —
       * `clusteredCladeLayout` writes what it is handed into `layout`, where a
       * `rowGroups` swatch color has no business, and `applyRowGroups` may
       * reorder into blocks besides. Under no subtree filter this is
       * `editableSources` itself.
       */
      get clusterableSources(): MultiRowSource[] {
        return filterRowsBySubtree(self.editableSources, self.subtreeFilter)
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
       * Per-row color (CSS) by display row — the single per-row resolver
       * (dialog color > config `sampleColorMap` > palette-when-default).
       * `undefined` where the row has none, and the worker-baked per-feature
       * color paints instead.
       */
      get rowColorStringsByIndex(): (string | undefined)[] {
        // Resolved over the unfiltered rows, then read back per display row: the
        // fallback palette indexes by row position, so resolving over the
        // filtered list would recolor every surviving row when the user focuses
        // a clade in the tree (filterRowsBySubtree is hide-only).
        const colors = resolveRowColorStrings(
          self.editableSources,
          self.sampleColorMap,
          self.colorConfig === undefined && !self.usedItemRgb,
        )
        const byName = new Map(
          self.editableSources.map((s, i) => [s.name, colors[i]] as const),
        )
        return self.sources.map(s => byName.get(s.name))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `rowColorStringsByIndex` packed for the painters. Applied at render time
       * over the worker-baked per-feature `color` slot, so any color change
       * repaints without a refetch.
       */
      get rowColorsByIndex(): (number | undefined)[] {
        return self.rowColorStringsByIndex.map(css =>
          css === undefined ? undefined : cssColorToABGR(css),
        )
      },
      /**
       * #getter
       * The rows as the sidebar draws them: `sources`, with each row's painted
       * color carried into `labelColor` when `colorRowLabels` is on.
       *
       * Off by default because the tint is not free — it spends the label box,
       * which `rowGroups` also spends (and wins here, along with a color set in
       * the arrangement dialog: both are something the user or the config
       * asked for by name, where this is derived). It earns the space on a
       * painting whose rows are palette-colored and whose labels are a wall of
       * similar names, and costs legibility on one where the labels were doing
       * fine, which is why it is a toggle rather than a judgment made here.
       *
       * A no-op in per-feature color mode: there is no single color a row is
       * painted in, `rowColorStringsByIndex` is `undefined` throughout, and the
       * labels come back exactly as `sources` had them.
       */
      get labelSources(): MultiRowSource[] {
        const colors = self.rowColorStringsByIndex
        return self.colorRowLabels
          ? self.sources.map((s, i) => ({
              ...s,
              labelColor: s.labelColor ?? colors[i],
            }))
          : self.sources
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
       * The `legend` config slot, validated into key rows. Its own getter
       * because two different questions read it: what is DRAWN (gated on there
       * being a painting, below) and whether this display has a key at all
       * (`hasLegendKey`, which the menu offers the toggle on).
       */
      get configuredLegend() {
        return resolveConfiguredLegend(readConfObject(self.conf, 'legend'))
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
       *
       * Both halves are gated on there being a painting to key: the derived one
       * by construction, since it reads `drawnRegionData`, and the configured
       * one through `hasDrawnFeatures` — a declared key is still a claim about
       * colors on screen, and while the density band stands in (or before the
       * first fetch lands, or over an empty contig) there are none.
       */
      get colorLegend() {
        const configured = self.hasDrawnFeatures ? self.configuredLegend : []
        return configured.length
          ? configured
          : buildColorLegend(
              self.drawnRegionData.values(),
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
       * Whether either key has a row to draw — the one place the pair is asked
       * about, by the on-screen legend, the SVG export and the "Show legend"
       * menu item.
       */
      get hasLegendEntries() {
        return self.colorLegend.length > 0 || self.rowGroupLegend.length > 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the display HAS a key, as opposed to whether one is on screen
       * right now — which is the question "Show legend" is offered on. A
       * configured `legend` slot counts before its first fetch and while the
       * density band stands in: the toggle is the user's, and a key merely
       * waiting for data must not take the way back to it with it.
       */
      get hasLegendKey() {
        return self.hasLegendEntries || self.configuredLegend.length > 0
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
       *
       * Floored at MIN_DISPLAY_HEIGHT for the same reason `setHeight` floors
       * what it writes, and here because the row count is the other way to
       * reach a sliver: a pinned 14px row height over no rows at all is a 14px
       * track, which is what an empty contig, a `subtreeFilter` naming nothing,
       * a saved session before its first fetch lands, and — with a whole chrome
       * of its own to draw — the too-large banner and the density band all get.
       * The floor is on the TRACK, never on the row: `effectiveRowHeight` and
       * the fit-mode arithmetic over `fitTargetHeight` are untouched, so a
       * sub-pixel row stays legitimate (see `autoRowHeight`).
       */
      get height(): number {
        return Math.max(MIN_DISPLAY_HEIGHT, self.nrow * self.effectiveRowHeight)
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
      get featurePaintInputs(): MultiRowFeaturePaintInputs {
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
          ? new Map<number, MultiRowRegionData>(self.drawnRegionData.entries())
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
    .views(self => {
      const index = createDrawnFeaturesByRowIndex()
      return {
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
         * only when the rows, the colors or the data do. What is held between
         * calls, and on which compares, is `createDrawnFeaturesByRowIndex`.
         *
         * Bucketing rather than a bare context, because the memo only removed the
         * *setup* from the pointer frame and left the scan: the row is known
         * before the search starts, so a hit on a 200-feature row was still
         * walking the region's other half-million. See `findTopDrawnFeatureInRow`.
         *
         * `featurePaintInputs` rather than the whole `renderState`, so that
         * "changes only when the rows, the colors or the data do" is actually
         * true — see there.
         *
         * The memo needs an observer to exist at all, which `afterAttach`
         * installs: the hit test reads this from a React event handler, and MobX
         * does not cache a computed nobody is watching.
         */
        get drawnFeaturesByRow(): Map<number, DrawnFeaturesByRow> {
          return index(
            self.drawnRegionData,
            self.featurePaintInputs,
            self.sources.length,
          )
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * The feature under a display-relative pixel — `featureAtPixel`, which
       * owns the row rule, the painted-span rule and the sidebar bound.
       */
      featureAt(mouseX: number, mouseY: number): MultiRowHit | undefined {
        return featureAtPixel(self, mouseX, mouseY)
      },
    }))
    .views(self => ({
      /**
       * #method
       * What a right-click at this display-relative pixel resolves to. Model-
       * side because it is the same question about the same pixel `featureAt`
       * asks; spelled out in the component it re-derived `pxToBp`, the sidebar
       * bound and the painted base.
       */
      contextTargetAt(mouseX: number, mouseY: number) {
        return contextTargetAtPixel(self, mouseX, mouseY)
      },

      /**
       * #getter
       * Screen box of the block to mark, or undefined when there's nothing to
       * mark. The hover drops when a right-click menu opens (else its tooltip
       * sticks under the menu), so the menu's own feature stands in — the block a
       * menu is acting on is exactly the one that should stay marked.
       */
      get highlightedBlockRect() {
        return hitBlockRect(
          self,
          self.hoveredFeature ?? self.contextMenuInfo?.hit,
        )
      },

      /**
       * #getter
       * The row the hovered feature sits on, off the live order — the tooltip's
       * label, resolved the way `highlightedBlockRect` resolves its row.
       */
      get hoveredRow(): MultiRowSource | undefined {
        return hitRow(self, self.hoveredFeature)
      },
    }))
    .actions(self => {
      const openDetails = createCanvasFeatureDetailsOpener(self)
      return {
        /**
         * #action
         */
        setShowRowSeparators(f: boolean) {
          setConf(self, 'showRowSeparators', f)
        },
        /**
         * #action
         */
        setColorRowLabels(f: boolean) {
          setConf(self, 'colorRowLabels', f)
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
          // Against the EFFECTIVE field, not the slot: with the slot at its empty
          // auto default the menu checks whatever auto picked, and picking that
          // same radio would otherwise pin it — a full refetch to produce the
          // painting already on screen, and an opt-out of auto nobody asked for.
          if (field === self.effectivePartitionField) {
            return
          }
          setConf(self, 'partitionField', field)
          self.clearLayout()
          self.hiddenCategories.clear()
        },
        /**
         * #action
         * Reorder the rows by the value each carries at (refName, pos) — the
         * feature covering that position on each row. Reads the already-loaded
         * region data (no refetch/RPC) and writes the new order via `layout`.
         *
         * The gates and the write are `sortRowsAtColumn`'s, shared with
         * multi-wiggle's twin; the rows here are additionally DISCOVERED from
         * `rpcDataMap` (see `sourcesWithoutLayout`), which empties whenever the
         * display is panned off its data or blanked by the density gate — so
         * "sorting" a track that is merely not loaded right now used to wipe it.
         */
        sortRowsByValueAt(refName: string, pos: number) {
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => self.drawnRegionData.get(index),
            // `featurePaintInputs` is the same triple the painters and the hit
            // test resolve "does this feature paint" from, so a hidden legend
            // category orders the rows the way it draws them
            (sources, region) =>
              rowOrderByValueAt(sources, region, pos, self.featurePaintInputs),
          )
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
         * complete feature is fetched on demand (GetCanvasFeatureDetails). A
         * region whose data has already gone is the same nothing-to-open as a
         * lookup miss.
         */
        selectFeatureById(featureId: string, displayedRegionIndex: number) {
          void openDetails(async () => {
            const region = self.loadedRegions.get(displayedRegionIndex)
            // Narrowed to the clicked feature's own span, which the packed
            // arrays already carry — the buffered region is a second download of
            // everything on screen to pick one row out of.
            const data = self.drawnRegionData.get(displayedRegionIndex)
            const i = data ? data.featureIds.indexOf(featureId) : -1
            const detailsRegion =
              region && data && i !== -1
                ? featureSpanRegion(
                    region,
                    data.featureStarts[i]!,
                    data.featureEnds[i]!,
                  )
                : region
            return detailsRegion
              ? fetchCanvasFeatureDetails(
                  getSession(self),
                  getRpcSessionId(self),
                  self.adapterConfig,
                  featureId,
                  detailsRegion,
                )
              : undefined
          })
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
        },
        /**
         * #action
         */
        startRenderingBackend(backend: MultiRowRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.drawnRegionData,
            // `featurePaintInputs`, never `renderState`: the instance buffer holds
            // {startBp,endBp,rowIndex,color} and no geometry — the row height and
            // canvas box reach the shader as uniforms, and both move on every
            // frame of a track-height drag. Declaring the narrow one is what keeps
            // a reorder / recolor / category toggle re-encoding without an RPC
            // roundtrip while a resize re-encodes nothing.
            inputs: () => self.featurePaintInputs,
            encode: (regionData, paintInputs) => ({
              instanceBuffer: buildMultiRowInstanceBuffer(
                regionData,
                paintInputs,
              ),
            }),
            render: b =>
              b.renderBlocks(
                self.renderBlocks,
                self.drawnRegionData,
                self.renderState,
              ),
          })
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * The reader-side check of the write-side rule: `loadedRegions` is written
       * where the payload is stored (`RegionFetchContext`), so an entry here
       * without one in `rpcDataMap` is that rule being broken. It costs a map
       * lookup and it decides which way the break fails — a refetch, or a
       * viewport that reads as covered against data nobody has and never asks
       * again.
       *
       * No zoom rule beside it: the worker's output is absolute genomic uint32,
       * so `regionFetchKey` stays at its empty default.
       *
       * **And the reconciliation for auto partitioning**, which is the second
       * thing this hook is for (MAF's "which of several held payloads answers"
       * is the first) — `regionHasPinnedData` is that half.
       *
       * A view, not an action: as an action MobX untracks the `rpcDataMap` read
       * and `FetchVisibleRegions` keeps a stale answer.
       */
      regionHasData(displayedRegionIndex: number) {
        return regionHasPinnedData(self, displayedRegionIndex)
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
          // What makes `drawnFeaturesByRow` a memo at all: its consumers are
          // pointer handlers, and MobX discards an unobserved computed's value
          // as it hands it over — so every mouse-move frame rebuilt every loaded
          // region's row index. Safe to hold because it keys off the data, the
          // rows and the colors, never live view geometry (see
          // `laneFlatbushIndexes` in plugin-variants for the getter where that
          // distinction bites).
          autorunOnReadyView(
            self,
            () => {
              void self.drawnFeaturesByRow
            },
            { name: 'MultiRowHitIndexes' },
          )
          setupTreeSidebarAutoruns(self, {
            name: 'MultiRowFeature',
            // Forwarded, not swallowed: `false` is "no loaded region covers
            // that column", and it holds `sortRowsBy` for the fetch that will.
            sortRows: (refName, pos) => self.sortRowsByValueAt(refName, pos),
            // "Cluster rows by similarity": the feature-matrix RPC over the
            // `clusterRegion` locus if the session named one, the visible
            // blocks if not
            clustering: {
              ready: () => self.clusterableSources.length > 1,
              run: async args => {
                const { runMultiRowClustering } =
                  await import('./runMultiRowClustering.ts')
                await runMultiRowClustering({ model: self, ...args })
              },
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
          sortRowsHereMenuItem({
            label: 'Sort rows by color here',
            rowCount: self.editableSources.length,
            onClick: () => {
              self.sortRowsByValueAt(info.refName, info.pos)
            },
          }),
          ...(hit
            ? [
                {
                  label: 'Open feature details',
                  icon: MenuOpenIcon,
                  onClick: () => {
                    self.selectFeatureById(hit.id, hit.regionIndex)
                  },
                },
                // The same row the feature display offers, built by the same
                // helper, for the same reason: it is the one thing in either
                // menu that gets pasted somewhere rather than read. A row
                // painting is where a reader is most likely to want it, since
                // nothing else here names the block's span.
                copyItem(
                  self,
                  'Copy location',
                  assembleLocString({
                    refName: hit.refName,
                    start: hit.start,
                    end: hit.end,
                  }),
                  'location',
                ),
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
            ...densityTierMenuItems(self),
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
