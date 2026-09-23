import {
  ConfigurationReference,
  getConf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { legendIsReadable } from '@jbrowse/core/ui'
import { assembleLocString, getSession } from '@jbrowse/core/util'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'
import { MIN_DISPLAY_HEIGHT } from '@jbrowse/display-kit/const'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import { autorunOnReadyView } from '@jbrowse/display-kit/displayAutoruns'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { types } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { maxCanvasCssPx } from '@jbrowse/render-core/canvas2dUtils'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'
import {
  ContextMenuMixin,
  RowHeightMixin,
  TreeSidebarMixin,
  baseDisplayConfig,
  buildSpatialIndex,
  computeClusterHierarchy,
  focusRowGroup,
  keptRows,
  resetRowOrderMenuItems,
  rowEdits,
  rowLabelsCarryText,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
  sortRowsHereMenuItem,
  treeDescribesRows,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { compareStructural } from 'mobx'

import DensityBandMixin from '../shared/DensityBandMixin.ts'
import { copyItem } from '../shared/copyMenuItem.ts'
import {
  featureSpanRegion,
  fetchCanvasFeatureDetails,
} from '../shared/fetchCanvasFeatureDetails.ts'
import { createCanvasFeatureDetailsOpener } from '../shared/openCanvasFeatureDetails.ts'
import { toggleArrayMember } from '../shared/toggleArrayMember.ts'
import { fetchMultiRowFeatures } from './fetchMultiRowFeatures.ts'
import {
  contextTargetAtPixel,
  featureAtPixel,
  hitInstance,
  hitRow,
} from './hitTesting.ts'
import {
  answeredPartitionField,
  effectivePartitionField,
  partitionCandidates,
  partitionRowCounts,
  pinnedPartitionField,
  resolveClusterField,
  regionHasPinnedData,
} from './partitionFields.ts'
import {
  buildColorLegend,
  resolveConfiguredLegend,
} from './rendering/colorLegend.ts'
import { buildMultiRowChannels } from './rendering/multiRowChannels.ts'
import { MULTI_ROW_MARKS } from './rendering/multiRowMarks.ts'
import { refuseRetiredState } from './retiredSettings.ts'
import { rowOrderByValueAt } from './rowOrderByValueAt.ts'
import {
  applyRowGroups,
  arrangeRows,
  editedRow,
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
import type { MultiRowEncoded } from './rendering/multiRowChannels.ts'
import type {
  MultiRowFeaturePaintInputs,
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowRenderingBackend,
} from './rendering/multiRowRenderingBackendTypes.ts'
import type { MultiRowSource, RowGroup } from './rowSources.ts'
import type { LegendItem, MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Region } from '@jbrowse/core/util'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

const EMPTY_REGION_DATA: ReadonlyMap<number, MultiRowRegionData> = new Map()

export type { MultiRowContextMenuInfo, MultiRowHit } from './hitTesting.ts'

/**
 * #stateModel LinearMultiRowFeatureDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * Partitions a single feature track into stacked rows by a feature attribute
 * and paints each feature as a colored block on its row.
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
      // After the foundation, whose region-too-large verdict it keys off.
      DensityBandMixin(),
      LegendMixin(),
      RowHeightMixin(),
      TreeSidebarMixin<MultiRowSource>(),
      ContextMenuMixin<MultiRowContextMenuInfo>(),
      StoredHoverMixin<MultiRowHit>(
        (a, b) => a.id === b.id && a.regionIndex === b.regionIndex,
      ),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearMultiRowFeatureDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Legend categories toggled off, by label; features painted in a hidden
         * category's color drop out of both render paths and the hit test.
         */
        hiddenCategories: types.array(types.string),
      }),
    )
    .preProcessSnapshot(refuseRetiredState)
    .views(self => ({
      /**
       * #getter
       * The foundation's per-region store, narrowed.
       */
      get rpcDataMap(): ReadonlyMap<number, MultiRowRegionData> {
        return self.regionPayloads as ReadonlyMap<number, MultiRowRegionData>
      },
    }))
    .views(self => ({
      /**
       * #getter
       * This display always draws its label above the plot.
       */
      get prefersOffset() {
        return true
      },
      /**
       * #getter
       * The loaded regions, or nothing while the density band stands in for
       * them, so a track forced to `density` draws the band alone.
       */
      get drawnRegionData(): ReadonlyMap<number, MultiRowRegionData> {
        return self.coarseTierStandsIn ? EMPTY_REGION_DATA : self.rpcDataMap
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get view() {
        return containingLgv(self)
      },
      /**
       * #getter
       * Config typed off the concrete schema, which ConfigurationReference
       * erases to any.
       */
      get conf(): LinearMultiRowFeatureDisplayConfig {
        return self.configuration
      },
      /**
       * #getter
       * The byte-gate opt-in: this display paints into fixed lanes, so a high
       * feature count is not a per-glyph render cost and only bytes gate it.
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
       * Whether the sidebar label box is tinted with its row's painted color.
       */
      get colorRowLabels(): boolean {
        return getConf(self, 'colorRowLabels')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The raw `rows.field`, forwarded to the worker which resolves it per
       * feature. Reading it through `readConfObject` would evaluate a `jexl:`
       * expression against no context and ship the empty string as an
       * attribute name, drawing one unnamed row with nothing thrown.
       */
      get rowsField(): string {
        return self.conf.rows.field
      },
      /**
       * #getter
       * The raw `clusterField` slot, `auto` until the user picks one.
       */
      get clusterField(): string {
        return self.conf.clusterField
      },
      /**
       * #getter
       * Feature attribute holding a signed bp length change vs the reference;
       * empty turns the indel-glyph pass off.
       */
      get lengthField(): string {
        return readConfObject(self.conf, 'lengthField')
      },
      /**
       * #getter
       * The colour key's declared order, off config. The blocks are painted
       * per feature, so this orders the key and nothing else.
       */
      get colorDomain(): string[] {
        return readConfObject(self.conf, 'colorDomain')
      },
      /**
       * #getter
       * Raw `color` slot, forwarded to the worker which resolves it per feature.
       */
      get colorConfig(): string | undefined {
        return self.conf.color
      },
      /**
       * #getter
       * The colour set on each named row, off `rowColor`, painting that whole
       * row over the per-feature `color`.
       */
      get rowColors(): ReadonlyMap<string, string> {
        return pairedColorsOf({
          domain: getConf(self, ['rowColor', 'domain']),
          range: getConf(self, ['rowColor', 'range']),
        })
      },
      /**
       * #getter
       * The `rowColor` the config.json declares for this display, which a
       * reset returns to and a dialog submit keeps the pair order of.
       */
      get baseRowColor(): {
        domain: readonly string[]
        range: readonly string[]
      } {
        const base = (baseDisplayConfig(self).rowColor ?? {}) as {
          domain?: string[]
          range?: string[]
        }
        return { domain: base.domain ?? [], range: base.range ?? [] }
      },
      /**
       * #getter
       * The row order the config.json declares, which the palette is dealt
       * over so that no arrangement recolours a row.
       */
      get baseRowDomain(): readonly string[] {
        const base = (baseDisplayConfig(self).rows ?? {}) as {
          domain?: string[]
        }
        return base.domain ?? []
      },
      /**
       * #getter
       */
      get rowProportion(): number {
        return readConfObject(self.conf, 'rowProportion')
      },
      /**
       * #getter
       * Regex-to-group entries tagging rows with a sidebar swatch color, applied
       * downstream of the arrangement so the derived color never lands in
       * persisted state and loses to a stale copy.
       */
      get rowGroups(): RowGroup[] {
        return readConfObject(self.conf, 'rowGroups')
      },
    }))
    .views(self => {
      // A plain getter hands out a fresh array on every write to `rpcDataMap`,
      // and this list reaches `featurePaintInputs`, whose identity has to hold
      // steady.
      const sourcesWithoutLayout = stableIdentityComputed(() => {
        const values = new Set<string>()
        for (const data of self.drawnRegionData.values()) {
          for (const v of data.partitionValues) {
            values.add(v)
          }
        }
        const unanswered = `(no ${effectivePartitionField(self)})`
        return orderPartitionValues(values, self.baseRowDomain).map(name =>
          name === '' ? { name, label: unanswered } : { name },
        )
      })
      return {
        /**
         * #getter
         * The distinct partition values across all loaded regions, in the
         * order the config.json declares, the rest sorted.
         */
        get sourcesWithoutLayout(): MultiRowSource[] {
          return sourcesWithoutLayout.get()
        },
        /**
         * #getter
         * Whether anything is painted right now. The configured `legend` slot
         * is gated on this.
         */
        get hasDrawnFeatures(): boolean {
          return [...self.drawnRegionData.values()].some(
            data => data.featureIds.length > 0,
          )
        },
        /**
         * #getter
         * Whether the loaded data colored itself via `itemRgb`, which suppresses
         * the per-row palette that would paint over those colors.
         */
        get usedItemRgb(): boolean {
          return [...self.drawnRegionData.values()].some(
            data => data.usedItemRgb,
          )
        },
        /**
         * #getter
         * The attribute a loaded region actually resolved its rows on, or
         * undefined while none has.
         */
        get answeredPartitionField(): string | undefined {
          return answeredPartitionField(self)
        },
        /**
         * #getter
         * The attribute the rows are actually partitioned on: the slot, or what
         * the worker picked off the data under auto. Everything asking "which
         * attribute are these rows" reads this rather than the raw slot above.
         */
        get effectivePartitionField(): string {
          return effectivePartitionField(self)
        },
        /**
         * #getter
         * The attribute each row's blocks are clustered on, resolving `auto`
         * off the coloring; empty clusters on presence alone.
         */
        get effectiveClusterField(): string {
          return resolveClusterField({
            clusterField: self.clusterField,
            colorConfig: self.colorConfig,
            candidates: partitionCandidates(self),
            partitionField: effectivePartitionField(self),
          })
        },
        /**
         * #getter
         * What a fetch issued now should partition on under auto. Deliberately
         * not an `rpcProps()` key, which would refetch every region the moment
         * the first one answered.
         */
        get pinnedPartitionField(): string {
          return pinnedPartitionField(self)
        },
        /**
         * #getter
         * The attribute names on the loaded features, offered by the
         * "Partition by..." menu.
         */
        get partitionCandidates(): string[] {
          return partitionCandidates(self)
        },
        /**
         * #getter
         * How many rows each candidate would draw, which the menu shows beside
         * each name so a reader can judge it before paying the refetch.
         */
        get partitionRowCounts(): ReadonlyMap<string, PartitionRowCount> {
          return partitionRowCounts(self)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * `TreeSidebarMixin`'s hook: whether `rowColor` names a colour the
       * config does not, so "Reset row order" is offered for a recolour too.
       */
      get rowStylingIsCustom(): boolean {
        return !compareStructural(
          Object.fromEntries(self.rowColors),
          Object.fromEntries(pairedColorsOf(self.baseRowColor)),
        )
      },
      /**
       * #getter
       * The discovered rows in the reader's arrangement — `rows.domain`
       * leading, `rows.labels` over the derived labels, each `rowColor` entry
       * as the row's `color` — with no focus, so the arrangement dialog seeds
       * from what was chosen.
       */
      get editableSources(): MultiRowSource[] {
        return arrangeRows(self.sourcesWithoutLayout, {
          domain: self.rowDomain,
          labels: self.rowLabels,
          colors: self.rowColors,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The rows a clustering run acts on, deliberately not the decorated
       * `sources` below, whose `rowGroups` swatch colour a run has no
       * business writing back.
       */
      get clusterableSources(): MultiRowSource[] {
        return keptRows(self.editableSources, self.rowFocus)
      },
      /**
       * #getter
       * The rows tagged with their `rowGroups` group and left in their current
       * order. A legend swatch focuses from these rows, because a second click
       * on another group has to reach the rows the first click hid, and the
       * filter matches the same `name`s.
       */
      get groupedSources(): MultiRowSource[] {
        return applyRowGroups(self.editableSources, self.rowGroups, {
          partition: false,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The display rows, which render order, label order and `rowIndexByValue`
       * all key off. `rowGroups` decorates them here but partitions them into
       * blocks only when no cluster tree already names this order.
       */
      get sources(): MultiRowSource[] {
        const rows = self.clusterableSources
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
       * Per-row CSS color by display row, `undefined` where the row has none
       * and the worker-baked per-feature color paints instead.
       */
      get rowColorStringsByIndex(): (string | undefined)[] {
        return resolveRowColorStrings(
          self.sources,
          self.colorConfig === undefined && !self.usedItemRgb
            ? self.sourcesWithoutLayout
            : undefined,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `rowColorStringsByIndex` packed for the painters, applied at render time
       * so any color change repaints without a refetch.
       */
      get rowColorsByIndex(): (number | undefined)[] {
        return self.rowColorStringsByIndex.map(css =>
          css === undefined ? undefined : cssColorToABGR(css),
        )
      },
      /**
       * #getter
       * The rows as the sidebar draws them, with each row's painted color
       * carried into `labelColor` when `colorRowLabels` is on. A `rowGroups`
       * `labelColor` wins, and per-feature color mode is a no-op.
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
       * Number of displayed rows, at least 1 so the auto-fit division is safe
       * and the canvas mounts before data arrives.
       */
      get nrow(): number {
        return Math.max(1, self.sources.length)
      },
      /**
       * #getter
       * The track height that auto-fit mode divides among rows.
       */
      get fitTargetHeight(): number {
        return readConfObject(self.conf, 'height')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The `legend` config slot, validated into key rows.
       */
      get configuredLegend() {
        return resolveConfiguredLegend(readConfObject(self.conf, 'legend'))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Categorical color key, the explicit `legend` slot winning over the one
       * derived from the loaded data. Both halves are gated on there being a
       * painting to key, since a key is a claim about colors on screen.
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
       * The single place "is this category hidden?" is answered, so a change to
       * how a label is matched cannot reach some legends and miss the rest.
       */
      get hiddenCategorySet(): ReadonlySet<string> {
        return new Set(self.hiddenCategories)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * ABGR colors currently hidden via the legend's category toggles. Both
       * render paths and the hit test skip features painted in one of these, so
       * a toggle drops it everywhere without a refetch.
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
       * The display height split evenly across rows. Deliberately not floored
       * at a pixel — `rowBand` widens a sub-pixel row for drawing without
       * changing how many rows fit, where a floor here would grow the track to
       * thousands of pixels instead.
       */
      get autoRowHeight(): number {
        return self.fitTargetHeight / self.nrow
      },
      /**
       * #getter
       * Ceiling on the whole row stack in CSS px: this display sizes its canvas
       * to its content and never scrolls, so nothing downstream bounds it.
       */
      get maxCanvasHeight(): number {
        return maxCanvasCssPx()
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides `RowHeightMixin`'s resolved height to cap the row stack at
       * `maxCanvasHeight`, since nothing downstream bounds it. The cap is not
       * floored back up: a row below a pixel is legitimate here.
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
       * Key for the `rowGroups` stripe, empty unless that stripe is the only
       * thing carrying row identity: above `rowLabelsCarryText` the sidebar
       * writes each row's name and a key would restate them, and with
       * `showRowLabels` off nothing draws the stripe for a key to name.
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
       * `LegendMixin`'s hook, two vocabularies as two scales: the per-feature
       * painting, toggleable and dimmed where a category is hidden, and the
       * row-group stripe, which names rows and is not.
       */
      get colorScales(): ColorScale[] {
        const hidden = self.hiddenCategorySet
        return [
          {
            kind: 'categorical' as const,
            id: 'features',
            title: 'Feature colors',
            domain: self.colorDomain,
            entries: self.colorLegend.map(e => ({
              value: e.label,
              label: e.label,
              color: abgrToCssRgba(e.color),
              hidden: hidden.has(e.label),
            })),
          },
          {
            kind: 'categorical' as const,
            id: 'rowGroups',
            title: 'Row groups',
            focusesRows: true,
            entries: self.rowGroupLegend.map(({ label, color }) => ({
              value: label,
              label,
              color,
            })),
          },
        ].filter(scale => scale.entries.length > 0)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides `LegendMixin`'s: a configured key merely waiting for data
       * must not take the way back to the "Show legend" toggle with it.
       */
      get hasLegendKey() {
        return self.colorScales.length > 0 || self.configuredLegend.length > 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides BaseLinearDisplay.height so the track container matches the
       * rendering canvas. The MIN_DISPLAY_HEIGHT floor is on the track, never
       * on the row, so a sub-pixel row stays legitimate while a display with no
       * rows at all still draws its own chrome.
       */
      get height(): number {
        return Math.max(MIN_DISPLAY_HEIGHT, self.nrow * self.effectiveRowHeight)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Positioned dendrogram, when a cluster tree exists and describes the rows
       * on screen. Passing the drawn row names is the backstop against anything
       * reordering `sources` downstream of the arrangement: such a reorder drops
       * the dendrogram rather than drawing it against rows it does not name.
       */
      get hierarchy() {
        return computeClusterHierarchy(
          self.root,
          self.sources,
          self.nrow * self.effectiveRowHeight,
          self.treeAreaWidth,
          self.showBranchLength,
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Pixel width reserved on the left for the tree, 0 when no tree shows.
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
       * The three inputs to "does this feature paint, and in what color".
       * Split out of `renderState`, whose canvas box and row geometry move on
       * every frame of a resize drag, so the encode memo behind
       * `encodedChannels` keys on something that moves only on a reorder,
       * recolor or refetch.
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
          canvasWidth: self.canvasWidthPx,
          canvasHeight: self.height,
          rowHeight: self.effectiveRowHeight,
          rowProportion: self.rowProportion,
          ...this.featurePaintInputs,
        }
      },
      /**
       * #getter
       * Per-region data for the indel-glyph overlay, undefined when there is no
       * glyph pass. A plain `Map` rather than the ObservableMap: the overlay
       * draws inside an effect, where nothing it reads is tracked, so the read
       * has to happen here for a refetch to redraw the glyphs.
       */
      get indelGlyphRegions() {
        return self.lengthField
          ? new Map<number, MultiRowRegionData>(self.drawnRegionData.entries())
          : undefined
      },
      /**
       * #method
       * Fetch-input cache keys; color is resolved in the worker, so the raw
       * color slot is one.
       */
      rpcProps() {
        return {
          partitionField: self.rowsField,
          lengthField: self.lengthField,
          colorConfig: self.colorConfig,
        }
      },
    }))
    .views(self => {
      const encoded = createEncodeMemo(
        () => self.drawnRegionData,
        // `featurePaintInputs`, never `renderState`: the channels hold
        // {x,x2,row,color} and no geometry — the row height and canvas box
        // reach the shape as uniforms, and both move on every frame of a
        // track-height drag. Declaring the narrow one is what keeps a
        // reorder / recolor / category toggle re-encoding without an RPC
        // roundtrip while a resize re-encodes nothing.
        () => self.featurePaintInputs,
        buildMultiRowChannels,
      )
      return {
        /**
         * #getter
         * Every loaded region's `span` channels with the per-row buckets the
         * hit test reads; one encode serves the upload, the hit test and the
         * SVG export. The memo lives in this closure so it outlives a
         * context-loss recovery, and `afterAttach` installs the observer it
         * needs to exist at all, since a pointer handler reading a computed
         * nobody watches caches nothing.
         */
        get encodedChannels(): ReadonlyMap<number, MultiRowEncoded> {
          return encoded()
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * The feature under a display-relative pixel.
       */
      featureAt(mouseX: number, mouseY: number): MultiRowHit | undefined {
        return featureAtPixel(self, mouseX, mouseY)
      },
    }))
    .views(self => ({
      /**
       * #method
       * What a right-click at this display-relative pixel resolves to.
       */
      contextTargetAt(mouseX: number, mouseY: number) {
        return contextTargetAtPixel(self, mouseX, mouseY)
      },

      /**
       * #getter
       * The box of the block to mark, for the chrome's highlight. The hover
       * drops when a right-click menu opens, else its tooltip sticks under the
       * menu, so the menu's own feature stands in.
       */
      get hoverInk(): HighlightRect[] {
        const hit = self.hoveredFeature ?? self.contextMenuInfo?.hit
        const instance = hitInstance(self, hit)
        return hit && instance
          ? inkOfInstances(
              MULTI_ROW_MARKS,
              self.renderBlocks,
              index => self.encodedChannels.get(index),
              self.renderState,
              index => (index === hit.regionIndex ? [instance] : undefined),
            )
          : []
      },
      /**
       * #getter
       * A wash and a border: the block colours are the data.
       */
      get highlightStyle(): HighlightStyle {
        return 'box'
      },

      /**
       * #getter
       * The row the hovered feature sits on, off the live order.
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
         * `LegendMixin`'s hook: a click on a row-group swatch narrows the rows
         * to that group. A feature-color row names a color rather than a set
         * of rows — the "Categories" submenu is what acts on those — so it
         * stays inert.
         */
        focusLegendEntry(scaleId: string, value: string) {
          if (scaleId === 'rowGroups') {
            focusRowGroup(self, self.groupedSources, s => s.group === value)
          }
        },
        /**
         * #action
         * Show/hide a legend category by label, at render time with no refetch.
         */
        toggleCategory(label: string) {
          toggleArrayMember(self.hiddenCategories, label)
        },
        /**
         * #action
         */
        setHiddenCategories(labels: string[]) {
          self.hiddenCategories.replace(labels)
        },
        /**
         * #action
         * Repartition. The arrangement and the row colours stay: a name keyed
         * on another field matches nothing and comes back with the field. The
         * legend's hidden categories clear. Writing `rows.field` refetches on
         * its own.
         */
        setRowsField(field: string) {
          // Against the effective field, not the slot: under auto the menu
          // checks whatever auto picked, and picking that same radio would pin
          // it — a full refetch to produce the painting already on screen.
          if (field === self.effectivePartitionField) {
            return
          }
          setConf(self, ['rows', 'field'], field)
          self.hiddenCategories.clear()
        },
        /**
         * #action
         * The arrangement dialog's submit: the order and labels to `rows`, and
         * the colours to `rowColor`, over the rows the dialog showed; a row no
         * loaded region holds keeps its entries.
         */
        applyRowEdits(rows: MultiRowSource[]) {
          const { labels, rowColor } = rowEdits({
            rows,
            labels: self.rowLabels,
            colors: self.rowColors,
            baseOrder: self.baseRowColor.domain,
            edited: editedRow(self.sourcesWithoutLayout),
          })
          self.configuration.setSubschema('rowColor', rowColor)
          self.setRowLabels(labels)
          self.setRowOrder(rows)
        },
        /**
         * #action
         * `TreeSidebarMixin`'s hook, so "Reset row order", a repartition and
         * the dialog's "Clear custom settings" return the row colours with the
         * arrangement.
         */
        resetRowStyling() {
          self.configuration.setSubschema(
            'rowColor',
            baseDisplayConfig(self).rowColor ?? {},
          )
        },
        /**
         * #action
         * Recluster on a different feature attribute; empty clusters on
         * presence alone.
         */
        setClusterField(field: string) {
          setConf(self, 'clusterField', field)
        },
        /**
         * #action
         * Reorder the rows by the value each carries at (refName, pos), off the
         * already-loaded region data with no refetch.
         */
        sortRowsByValueAt(refName: string, pos: number) {
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => self.drawnRegionData.get(index),
            // The same triple the painters resolve "does this feature paint"
            // from, so a hidden legend category orders the rows as it draws
            // them.
            (sources, region) =>
              rowOrderByValueAt(sources, region, pos, self.featurePaintInputs),
          )
        },
        /**
         * #action
         * Re-fetch the full clicked feature by id and open it in the feature
         * details widget, since the painting ships only the slim render arrays.
         */
        selectFeatureById(featureId: string, displayedRegionIndex: number) {
          void openDetails(async () => {
            const region = self.loadedRegions.get(displayedRegionIndex)
            // Narrowed to the clicked feature's own span, which the packed
            // arrays already carry; the buffered region would re-download
            // everything on screen to pick one feature out of it.
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
         * Stage a region as fetched, so a test stands up a loaded display in one
         * call; production goes through `ctx.commitRegion`.
         */
        setRpcData(
          regionIndex: number,
          data: MultiRowRegionData,
          region: Region,
        ) {
          self.setLoadedRegion(regionIndex, region, data)
        },
        /**
         * #action
         * Set the track height: auto-fit restretches the rows to it, fixed mode
         * redistributes it across the current rows as a row height.
         */
        // Both branches floor the track at MIN_DISPLAY_HEIGHT, never the row: a
        // sub-pixel row is legitimate here, and flooring the row instead stalls
        // a shrink drag on a large cohort while letting a 3-row track collapse
        // past the point where its resize handle can be grabbed again.
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
         * Drag-resize, deferring to `setHeight`.
         */
        resizeHeight(distance: number) {
          const oldHeight = self.height
          self.setHeight(self.height + distance)
          return self.height - oldHeight
        },
        /**
         * #action
         * Switch to auto-fit, seeding the `height` slot from the current content
         * height so toggling on does not jump.
         */
        setFitToHeight() {
          setConf(self, 'height', self.height)
          setConf(self, 'rowHeight', 0)
        },
        /**
         * #action
         */
        startRenderingBackend(backend: MultiRowRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.encodedChannels,
            render: (b, encoded) =>
              b.renderBlocks(self.renderBlocks, encoded, self.renderState),
          })
        },
      }
    })
    .views(self => ({
      /**
       * #method
       * A region that answered a different attribute than the pin holds nothing
       * this display can draw, and is refetched with the field spelled out. A
       * view, not an action: an action untracks the `rpcDataMap` read and
       * `FetchVisibleRegions` keeps a stale answer.
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
        afterAttach() {
          // What makes `encodedChannels` a memo at all: its consumers are
          // pointer handlers, and MobX discards an unobserved computed's value
          // as it hands it over. Safe to hold because it keys off the data, the
          // rows and the colors, never live view geometry.
          autorunOnReadyView(
            self,
            () => {
              void self.encodedChannels
            },
            { name: 'MultiRowEncodedChannels' },
          )
          setupTreeSidebarAutoruns(self, {
            name: 'MultiRowFeature',
            // Forwarded, not swallowed: `false` is "no loaded region covers
            // that column", and it holds `sortRowsBy` for the fetch that will.
            sortRows: (refName, pos) => self.sortRowsByValueAt(refName, pos),
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
       * Items for the right-click context menu, built from the clicked position.
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
