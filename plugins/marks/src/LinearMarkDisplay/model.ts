import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import {
  assembleLocString,
  getDialogHost,
  getSession,
  pluralize,
} from '@jbrowse/core/util'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { rampDomain } from '@jbrowse/core/util/colorRamp'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'
import {
  installPrerequisiteFetch,
  readFor,
} from '@jbrowse/core/util/installPrerequisiteFetch'
import {
  baseJexlFilters,
  configuredJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { withHitIndex } from '@jbrowse/core/util/markEncoding'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { selectEncodedFeature } from '@jbrowse/core/util/selectEncodedFeature'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import DensityTierMixin from '@jbrowse/display-kit/DensityTierMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { featureColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'
import { coarseTierModeOf } from '@jbrowse/display-kit/densityTier'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { openPlotDialog as queuePlotDialog } from '@jbrowse/display-kit/plotMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import {
  sameAsLast,
  stableIdentityComputed,
} from '@jbrowse/display-kit/stableIdentityComputed'
import { viewRegionTable } from '@jbrowse/display-kit/viewRegionTable'
import {
  YSCALEBAR_LABEL_OFFSET,
  leftAxisGutterWidth,
} from '@jbrowse/display-ui'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { installUpload } from '@jbrowse/render-core/installUpload'
import {
  RowKeys,
  inkOfInstances,
  shiftInk,
  keySlot,
  pointInsetPx,
} from '@jbrowse/render-core/marks'
import {
  RowHeightMixin,
  TreeSidebarMixin,
  buildSpatialIndex,
  computeClusterHierarchy,
  orderRowsByValueAt,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import {
  DEFAULT_POINT_DIAMETER_PX,
  ScoreScaleMixin,
  autoscaleDomainFromSpans,
  axisPlotBox,
  computeSpanStats,
  resolveRenderState,
  resolveSymlogConstant,
  visibleStatsRange,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import { autorun } from 'mobx'

import { densityRegionData } from './densityLayer.ts'
import {
  facetLayout,
  facetRegion,
  rowsLayout,
  sectionsOn,
  unsplitRegion,
} from './facet.ts'
import { fetchPlotFields, plotScanRegions } from './fetchPlotFields.ts'
import { sameMarkHit } from './findMarkHit.ts'
import {
  buildMarkLegend,
  colorSection,
  keySettingOf,
  markColorScales,
  markConstantColor,
  paintScaleOf,
} from './legend.ts'
import { createLinkOwners, withMateRegions } from './linkOwners.ts'
import { baselineReached, layerSpans } from './markAutoscale.ts'
import { markColorOf, withMarkColors } from './markColor.ts'
import {
  buildMarkList,
  highestRow,
  markDrawsAt,
  markRowHeightPx,
  rowValuesAt,
} from './markList.ts'
import { markContextMenuItems, markTrackMenuItems } from './markMenus.ts'
import { markPlotSettingsOf } from './markPlot.ts'
import { markProblems, problemText } from './markProblems.ts'
import {
  lastBinEdges,
  markEntryOf,
  markLayerRequest,
  positionSource,
  stepsOf,
  toBinEdges,
  widestBinStep,
} from './markRequest.ts'
import { hitsByIndex, readsValue } from './markSpecs.ts'
import {
  DEFAULT_LINE_WIDTH_PX,
  DEFAULT_LINK_STROKE_PX,
} from './markVocabulary.ts'
import { sharedKeyNotice, sharedKeysOf } from './pinDistinct.ts'
import { defaultPlot } from './plotDefault.ts'
import {
  drawnKeysOf,
  drawnRegion,
  keyRegion,
  listingNamesRows,
  markRowTable,
} from './rowTable.ts'
import { stepChannels } from './stepChannels.ts'

import type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
import type {
  LinearMarkDisplayConfig,
  LinearMarkDisplayConfigModel,
  MarkConfig,
  MarkTransformStepConfig,
  MarkType,
} from './configSchema.ts'
import type { FacetLayout } from './facet.ts'
import type { MarkHitInfo } from './findMarkHit.ts'
import type { MateRegion } from './linkOwners.ts'
import type { RegionLayer } from './markAutoscale.ts'
import type { ColorSource } from './markColor.ts'
import type {
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  TextMarkEntry,
} from './markList.ts'
import type { MarkPlot, MarkPlotSettings } from './markPlot.ts'
import type {
  FacetSnapshot,
  MarkProblem,
  RowsSnapshot,
  ScalesSnapshot,
  StepSnapshot,
} from './markProblems.ts'
import type { PlotFields } from './scanPlotFields.ts'
import type { StepChannels } from './stepChannels.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  ListedRowSource,
  RowSourceListing,
} from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AdapterRead } from '@jbrowse/core/util/installPrerequisiteFetch'
import type {
  EncodedLayersResult,
  FacetSpec,
  LayerRequest,
  MarkEncoding,
  SizeScaleTable,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { CoarseTierMode } from '@jbrowse/display-kit/coarseTier'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  LinkRegion,
  LinkSizeScale,
  MarkColorScale,
  RowTable,
} from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { RowSource, SvgSidebarProps } from '@jbrowse/tree-sidebar'
import type { ValueScale } from '@jbrowse/wiggle-core'

export type MarkRenderingBackend = PerRegionRenderingBackend<
  MarkRegionData,
  MarkRenderState
>

const MarkPlotDialog = lazy(() => import('./components/MarkPlotDialog.tsx'))

const NO_REGIONS: ReadonlyMap<number, MarkRegionData> = new Map()
const NO_LINK_REGIONS: readonly LinkRegion[] = []

function storedRegionData(result: EncodedLayersResult): MarkRegionData {
  return {
    layers: result.layers.map(layer => withHitIndex(layer)),
    facet: result.facet,
    zoomRange: result.zoomRange,
    notices: result.notices,
  }
}

/**
 * A mark's `encoding.size` number with its type's default where none is
 * written: a point's diameter, a rule's thickness, the 1 px a line strokes at
 * or the 2 px a link does.
 */
export function markSizeOf({
  mark,
  encoding,
}: Pick<MarkConfig, 'mark' | 'encoding'>) {
  return (
    encoding.size.value ??
    (mark === 'link'
      ? DEFAULT_LINK_STROKE_PX
      : mark === 'line'
        ? DEFAULT_LINE_WIDTH_PX
        : DEFAULT_POINT_DIAMETER_PX)
  )
}

/** The marks at the view's zoom: which draw, and which the sidecar stands in for. */
export interface MarkView {
  visible: boolean[]
  densityMark: number
}

/**
 * #stateModel LinearMarkDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * A display declared in config: a list of marks, each with an encoding from
 * feature fields to channels, drawn in order over one score axis from one
 * worker fetch per region.
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: LinearMarkDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearMarkDisplay',
        // Nested so the parts stay under `types.compose`'s nine, the ceiling
        // whose tenth part erases every prop instead of failing.
        types.compose(
          BaseDisplay,
          TrackHeightMixin(),
          MultiRegionDisplayMixin(),
          TreeSidebarMixin(),
          RowHeightMixin(),
        ),
        // Where the byte gate refuses the features, a mark declaring
        // `source: 'density'` draws the adapter's sidecar in the banner's place
        // — see `densityPayloads`.
        DensityTierMixin(),
        ScoreScaleMixin(),
        LegendMixin(),
        ContextMenuMixin<MarkDisplayContextMenuInfo>(),
        StoredHoverMixin<MarkHitInfo>(sameMarkHit),
        HiddenGroupsMixin(),
        // #region configRef
        types.model({
          type: types.literal('LinearMarkDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          // #endregion
        }),
      )
      .views(() => ({
        /**
         * #getter
         * Opt into the byte gate: `CoreGetEncodedLayers` measures the index before
         * it downloads, so an over-budget region is refused before a feature is
         * read, and the density tier draws in place of the refused region.
         */
        get gateEnabled() {
          return true
        },
      }))
      // #region chainedViews
      .views(self => ({
        /**
         * #getter
         * the config typed off the concrete schema
         */
        get conf(): LinearMarkDisplayConfig {
          return self.configuration
        },
      }))
      // #endregion
      .views(self => ({
        /**
         * #getter
         * the track label sits above the plot so the y-axis stays on the edge
         */
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * Overridable hook: what every region's fetch hands the adapter beside
         * the region and the zoom, or undefined for nothing. A fetch input, so
         * a change refetches; `resolveAdapterOptions` places it on each region.
         * Manhattan's LD join is one.
         */
        get adapterOptions(): object | undefined {
          return undefined
        },
        /**
         * #method
         * Overridable hook: `adapterOptions` as one region's fetch sends them
         * as `CoreGetEncodedLayers`'s `opts`, resolved on the main thread,
         * where the assembly's aliases are; undefined sends none.
         */
        resolveAdapterOptions(
          options: object,
          _region: Region,
          _signal: AbortSignal,
        ): Promise<object | undefined> {
          return Promise.resolve(options)
        },
        /**
         * #getter
         * The declared marks' types, in draw order.
         */
        get markTypes(): MarkType[] {
          return self.conf.marks.map(m => m.mark)
        },
        /**
         * #getter
         * The `facet` object as written, or undefined while unfaceted.
         */
        get facet(): FacetSetting | undefined {
          return facetSettingOf({
            field: getConf(self, ['facet', 'field']),
            domain: getConf(self, ['facet', 'domain']),
          })
        },
        /**
         * #getter
         * `HiddenGroupsMixin`'s hook: a section key means nothing outside the
         * facet that issued it, so moving the field drops what was hidden.
         */
        get groupKeySpace(): string {
          return groupKeySpaceOf(this.facet)
        },
        /**
         * #getter
         * Each mark's type and zoom range, what the mark list is built from.
         */
        get markEntries(): MarkEntry[] {
          const { markChannels } = this
          return self.conf.marks.map((m, i) => markEntryOf(m, markChannels[i]!))
        },
        /**
         * #getter
         * Each mark as the text layer places it: the entry with whether it
         * names a `y` and whether its colour is written, a constant or a
         * scale. Its own getter so a slot only a label reads never remakes
         * the mark list.
         */
        get textMarkEntries(): TextMarkEntry[] {
          const { marks } = self.conf
          return this.markEntries.map((entry, i) => ({
            ...entry,
            ownColor:
              featureColorEncoding(marks[i]!.encoding.color) !== undefined,
          }))
        },
        /**
         * #getter
         * The marks at the view's zoom: whether each draws, inside its
         * `minBpPerPx`..`maxBpPerPx` range where 0 is no bound, and the first
         * drawing mark the density sidecar stands in for, -1 where none does.
         */
        get markView(): MarkView {
          const { bpPerPx } = self.host
          const { marks } = self.conf
          const visible = this.markEntries.map(entry =>
            markDrawsAt(entry, bpPerPx),
          )
          return {
            visible,
            densityMark: marks.findIndex(
              (m, i) =>
                visible[i] && m.source === 'density' && readsValue(m.mark),
            ),
          }
        },
        /**
         * #getter
         * The mark the density sidecar stands in for, or -1.
         */
        get densityMarkIndex(): number {
          return this.markView.densityMark
        },
        /**
         * #getter
         * Each mark's `encoding.size` number in px, its type's default where
         * none is written, which a bar or span leaves unread.
         */
        get markSizes(): number[] {
          return self.conf.marks.map(markSizeOf)
        },
        /**
         * #getter
         * Each mark's `rowProportion`, which a span alone reads.
         */
        get markRowProportions(): number[] {
          return self.conf.marks.map(m => m.rowProportion)
        },
        /**
         * #getter
         * The proportion the Row height dialog shows: the first span's, or
         * undefined where no mark is a span, so the dialog asks for none.
         */
        get rowProportion(): number | undefined {
          return self.conf.marks.find(m => m.mark === 'span')?.rowProportion
        },
        /**
         * #getter
         * Whether any mark is a link, whose feet place through the view's
         * regions rather than the block's own range.
         */
        get hasLinkMark(): boolean {
          return self.conf.marks.some(m => m.mark === 'link')
        },
        /**
         * #getter
         * The size the Point size menu shows: the first point mark's, or the
         * default where no mark is a point.
         */
        get pointSize(): number {
          const first = self.conf.marks.find(m => m.mark === 'point')
          return first ? markSizeOf(first) : DEFAULT_POINT_DIAMETER_PX
        },
        /**
         * #getter
         * The declared marks' encodings, as the worker takes them.
         */
        get encodings(): MarkEncoding[] {
          return this.layerRequests.map(request => request.encoding)
        },
        /**
         * #getter
         * The steps that run before each mark's encode, in order: the
         * display's, the facet's, then the mark's own.
         */
        get markStepLists(): MarkTransformStepConfig[][] {
          const shared = [...self.conf.transform, ...self.conf.facet.transform]
          return self.conf.marks.map(m => [...shared, ...m.transform])
        },
        /**
         * #getter
         * The channels each mark's steps fill where its encoding leaves them
         * unwritten.
         */
        get markChannels(): StepChannels[] {
          return this.markStepLists.map(steps => stepChannels(steps))
        },
        /**
         * #getter
         * Where each mark's colour comes from (`markColor.ts`), read from the
         * config alone, so editing a colour recolours the loaded regions
         * rather than fetching them again.
         */
        get markColors(): ColorSource[] {
          const { markChannels } = this
          return self.conf.marks.map((m, i) =>
            markColorOf(m, markChannels[i]!, self),
          )
        },
        /**
         * #getter
         * The facet's own steps as the worker takes them, run over each section
         * before any mark's; with no field to split on they run over the one
         * section there is, after the display's own steps.
         */
        get facetSteps(): TransformStep[] {
          return stepsOf(
            self.conf.facet.transform,
            self.host.bpPerPx,
            lastBinEdges(self.conf.transform),
          )
        },
        /**
         * #getter
         * The worker request, one layer per mark: its encoding and the lanes
         * its type reads. Every mark is sent, the one outside its zoom range
         * included, so the worker encodes a layer the view will not draw:
         * measured at 280 ns a feature, 28 ms per 100,000, for the excluded
         * half of the default multiscale pair (`encodeFeatures.bench.ts`, the
         * pair table), against a parse in the hundreds of milliseconds. An
         * empty slot for it would make the zoom a fetch input and refetch the
         * pair on every crossing, so there is none (ADR-112). Its `auto` bin
         * resolves at the bound it next draws at, so a zoom outside its range
         * refetches nothing.
         */
        get layerRequests(): LayerRequest[] {
          const { bpPerPx } = self.host
          const binEdges =
            lastBinEdges(self.conf.facet.transform) ??
            lastBinEdges(self.conf.transform)
          const { markChannels } = this
          return self.conf.marks.map((m, i) =>
            markLayerRequest(m, markChannels[i]!, bpPerPx, binEdges),
          )
        },
        /**
         * #getter
         */
        get origin(): number {
          return getConf(self, 'origin')
        },
        /**
         * #getter
         */
        get minWidthPx(): number {
          return getConf(self, 'minWidthPx')
        },
        /**
         * #getter
         * the `filter` slot
         */
        get configuredFilters() {
          return () => configuredJexlFilters(self)
        },
        /**
         * #getter
         * What the track's config declares for `filter`, which "Clear all
         * filters" returns to.
         */
        get baseFilters() {
          return () => baseJexlFilters(self)
        },
        /**
         * #getter
         * `rows.field` as written: the field each value of which takes a row.
         */
        get rowsField(): string {
          return getConf(self, ['rows', 'field'])
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the display draws one row per value: a `rows` field and no
         * `facet`, which draws in its place until bands of rows land.
         */
        get drawsRows(): boolean {
          return self.rowsField !== '' && !self.facet
        },
        /**
         * #getter
         * Whether each `row` lane holds a key the row table places: under
         * `rows`, except while the density sidecar stands in, whose bins
         * count every row's features and draw as one band.
         */
        get drawsKeyedRows(): boolean {
          return this.drawsRows && !self.coarseTierStandsIn
        },
        /**
         * #getter
         * The field the worker splits the features on: the facet's, else the
         * rows'. One split serves both, so `rows` sends it as `facet`.
         */
        get splitField(): string | undefined {
          return (
            self.facet?.field ?? (this.drawsRows ? self.rowsField : undefined)
          )
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: none, since a row is a value of the rows
         * field and carries no attribute of its own.
         */
        get rowColorFields(): readonly string[] {
          return []
        },
      }))
      .views(self => ({
        /**
         * #getter
         * `CoarseTierMixin`'s hook, narrowed: with no mark declaring the
         * sidecar there is nothing to draw the bins as, so the tier neither
         * reads nor stands in and the banner is the answer it always was.
         */
        get coarseTierMode(): CoarseTierMode {
          return self.densityMarkIndex === -1
            ? 'never'
            : coarseTierModeOf(self.densityTierMode)
        },
        /**
         * #getter
         * The tier's bins as this display's own payload: the density mark's
         * layer built from the sidecar's intervals, every other mark empty.
         * Keyed off `coarseTier`, which moves once per read.
         */
        get densityPayloads(): ReadonlyMap<number, MarkRegionData> {
          const markIndex = self.densityMarkIndex
          const mark = self.conf.marks[markIndex]
          const payloads = new Map<number, MarkRegionData>()
          if (mark) {
            const color = markConstantColor(mark)
            for (const [index, bins] of self.coarseTier) {
              payloads.set(
                index,
                densityRegionData(
                  bins,
                  self.conf.marks.length,
                  markIndex,
                  color,
                  hitsByIndex(mark.mark),
                ),
              )
            }
          }
          return payloads
        },
        /**
         * #getter
         * The layers as they came back, keyed by displayedRegionIndex: the
         * foundation's per-region store, or the density tier's bins where the
         * gate refused the features and a mark declared the sidecar. One map,
         * so the domain, the legend, the hover, the highlight and the SVG
         * export read the tier through the paths they already had.
         */
        get featurePayloads(): ReadonlyMap<number, MarkRegionData> {
          return self.coarseTierStandsIn
            ? this.densityPayloads
            : (self.regionPayloads as ReadonlyMap<number, MarkRegionData>)
        },
      }))
      .volatile(() => ({
        /**
         * #volatile
         * The latest `MarkGetRowSources` answer, stamped with the adapter
         * config it answers.
         */
        sourceListing: undefined as
          | AdapterRead<RowSourceListing | undefined>
          | undefined,
      }))
      .actions(self => ({
        /**
         * #action
         */
        setSourceListing(read: AdapterRead<RowSourceListing | undefined>) {
          self.sourceListing = read
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The adapter's row listing where it names the rows drawn: its field
         * is `rows.field`, or the key a `flatten` in the shared steps wrote
         * over its field. Undefined for an adapter that lists none, one that
         * lists another field, and until the current adapter config's
         * listing lands.
         */
        get rowListing(): RowSourceListing | undefined {
          const listing = readFor(self, self.sourceListing)
          return listing &&
            listingNamesRows(self.rowsField, listing.field, [
              ...self.conf.transform,
              ...self.conf.facet.transform,
            ])
            ? listing
            : undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The sources the adapter lists whatever a region holds, a
         * multi-BigWig's files or a MAF's species, in the adapter's order.
         */
        get adapterSources(): ListedRowSource[] | undefined {
          return self.rowListing?.sources
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the guide tree the adapter lists over
         * the rows, a MAF's species tree.
         */
        get guideTreeNewick(): string | undefined {
          return self.rowListing?.tree
        },
      }))
      .views(self => {
        // Identity-stable, since the layout below keys the upload on it and a
        // region arriving with the same values discovers nothing new.
        const discoveredRows = stableIdentityComputed(() => {
          if (!self.drawsRows) {
            return []
          }
          const field = categoricalField(self.rowsField)
          const listed = new Map(
            self.adapterSources?.map(source => [source.name, source]),
          )
          const found = new Set<string>()
          for (const region of self.featurePayloads.values()) {
            for (const { key } of sectionsOn(region, self.rowsField) ?? []) {
              if (!listed.has(key)) {
                found.add(key)
              }
            }
          }
          return [...listed.keys(), ...[...found].sort(field.compare)].map(
            (name): RowSource => {
              const own = listed.get(name)
              const label = own?.label ?? field.label(name)
              return {
                name,
                ...(label === name ? {} : { label }),
                ...(own?.color ? { color: own.color } : {}),
              }
            },
          )
        })
        return {
          /**
           * #getter
           * `TreeSidebarMixin`'s hook: every row the adapter lists over the
           * rows' field, in its order and with its label and colour, so a
           * source with nothing in the loaded regions keeps its row; then the
           * other values the worker split the loaded regions on, in the order
           * the field's sections stack.
           */
          get discoveredRows(): RowSource[] {
            return discoveredRows.get()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The rows drawn, top to bottom: the arrangement narrowed to the focus.
         */
        get sources(): RowSource[] {
          return self.clusterableSources
        },
      }))
      .views(self => {
        let keySpace = { field: '', rowKeys: new RowKeys() }
        return {
          /**
           * #getter
           * The key each value of `rows.field` holds across every loaded
           * region, assigned at the value's first arrival and never moved; a
           * new field is a new key space.
           */
          get rowKeys(): RowKeys {
            const field = self.rowsField
            if (keySpace.field !== field) {
              keySpace = { field, rowKeys: new RowKeys() }
            }
            return keySpace.rowKeys
          },
        }
      })
      .views(self => {
        const layout = stableIdentityComputed(() => {
          if (self.drawsKeyedRows) {
            return rowsLayout(self.sources, categoricalField(self.rowsField))
          }
          const { field = '', domain = [] } = self.facet ?? {}
          return facetLayout(
            self.featurePayloads.values(),
            categoricalField(field, { domain }),
            self.hiddenGroupKeys,
            self.markView.visible,
          )
        })
        // A fresh array per read would recolour every region on each read
        // nothing observes, so an equal one keeps the last one's identity.
        const sameColors = sameAsLast<ColorSource[]>()
        // Each region is coloured here, first, so the rows, the sections, the
        // legend and the painters all read its colours as if the worker had
        // sent them.
        const colored = createEncodeMemo(
          () => self.featurePayloads,
          () => sameColors(self.markColors),
          withMarkColors,
        )
        const keyed = createEncodeMemo(
          () => (self.drawsKeyedRows ? colored() : NO_REGIONS),
          () => self.rowKeys,
          (region, rowKeys) => keyRegion(region, rowKeys, self.rowsField),
        )
        const faceted = createEncodeMemo(
          () => (self.facet ? colored() : NO_REGIONS),
          () => layout.get(),
          facetRegion,
        )
        const unsplit = createEncodeMemo(
          () => (self.drawsKeyedRows || self.facet ? NO_REGIONS : colored()),
          undefined,
          unsplitRegion,
        )
        const drawn = () =>
          self.drawsKeyedRows ? keyed() : self.facet ? faceted() : unsplit()
        const mateRegions = stableIdentityComputed((): MateRegion[] =>
          self.host.displayedRegions.map((r, index) => ({
            index,
            refName: r.refName,
            start: r.start,
            end: r.end,
            assemblyName: r.assemblyName,
          })),
        )
        const canonical = (assemblyName: string, refName: string) =>
          getSession(self)
            .assemblyManager.get(assemblyName)
            ?.getCanonicalRefName2(refName) ?? refName
        const mated = createEncodeMemo(
          () => (self.hasLinkMark ? drawn() : NO_REGIONS),
          () => mateRegions.get(),
          (data, regions, index) =>
            withMateRegions(data, regions, canonical, index),
        )
        const owners = createLinkOwners()
        return {
          /**
           * #getter
           * The sections drawn over every loaded region, in the domain's order
           * and less the hidden ones, and where each key's rows start; under
           * `rows`, one row per value in the rows' order, which no chip names.
           */
          get facetLayout(): FacetLayout {
            return layout.get()
          },
          /**
           * #getter
           * The layers the display draws. Under a facet every region's rows
           * are offset onto the one layout, so a chip and the band beside it
           * agree whichever region a span came from; under `rows` every row
           * is a key the row table places, so a reorder or a focus moves no
           * instance. A region is offset or keyed again only when it, the
           * facet's layout or the key space moves, which is what the upload
           * re-packs.
           */
          get rpcDataMap(): ReadonlyMap<number, MarkRegionData> {
            return self.hasLinkMark
              ? owners(mated(), mateRegions.get(), canonical)
              : drawn()
          },
        }
      })
      .views(self => {
        const keyNames = stableIdentityComputed(() => {
          void self.rpcDataMap
          return self.rowKeys.names.slice()
        })
        const order = stableIdentityComputed(() =>
          self.sources.map(row => row.name),
        )
        return {
          /**
           * #getter
           * Under `rows`, the table every mark places a key through: its slot
           * in the rows' order, hidden where the focus leaves it out. Rebuilt
           * on a reorder, a focus or a new value, which uploads one small
           * texture and no instance bytes. Undefined wherever the lanes are
           * not keys.
           */
          get rowTable(): RowTable | undefined {
            return self.drawsKeyedRows
              ? markRowTable(keyNames.get(), order.get())
              : undefined
          },
        }
      })
      .views(self => {
        const drawnKeys = stableIdentityComputed(() => {
          const table = self.rowTable
          return (
            table &&
            drawnKeysOf(
              table,
              self.rpcDataMap.values(),
              self.rowKeys,
              self.rowsField,
            )
          )
        })
        const scaled = createEncodeMemo(
          () => self.rpcDataMap,
          () => drawnKeys.get(),
          (data, drawn) => (drawn ? drawnRegion(data, drawn) : data),
        )
        return {
          /**
           * #getter
           * 1 at each key the row table draws, undefined while every key a
           * loaded region carries is drawn: a focus moves it, a reorder does
           * not.
           */
          get drawnKeys(): Uint8Array | undefined {
            return drawnKeys.get()
          },
          /**
           * #getter
           * `rpcDataMap` with each layer's key and extents over the instances
           * the row table draws, its lanes shared: what the legend, the axis
           * and the size scales read, so a row the focus hides leaves them as
           * it leaves the plot.
           */
          get scaleDataMap(): ReadonlyMap<number, MarkRegionData> {
            return drawnKeys.get() ? scaled() : self.rpcDataMap
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The mark list the marks declare — one `defineMark` per config entry
         * with a shape, reading `layers[markIndex]`, off outside its zoom range.
         * A text mark has no shape and is the text layer's, so the list is
         * shorter than `marks` where one is declared. Recomputed only when the
         * entries move, so the component can key its backend factory on it.
         */
        get markList() {
          return buildMarkList(self.markEntries)
        },
        /**
         * #getter
         * Whether a point mark draws at the view's zoom, for the Point size menu.
         */
        get hasPointMark(): boolean {
          return this.drawingMarkIndices.some(
            i => self.markTypes[i] === 'point',
          )
        },
        /**
         * #getter
         * Every mark drawing at this zoom, in list order: what folds into the y
         * domain and what the plot's inset and row count are read from.
         */
        get drawingMarkIndices(): number[] {
          const { visible } = self.markView
          return self.markTypes.flatMap((_, i) => (visible[i] ? [i] : []))
        },
      }))
      .views(self => ({
        /**
         * #getter
         * [min, max] over the `y` of every mark drawing at this zoom, through
         * the autoscale mode `scales.y` names, widened to every rule the scale
         * declares and to the origin whenever a bar mark draws, or undefined
         * before any valued mark loads
         */
        get autoscaleRange() {
          const indices = self.drawingMarkIndices
          const folded = new Set(indices)
          const types = indices.map(i => self.markTypes[i]!)
          const { origin, domainQuantile, drawnKeys, scaleType } = self
          const reached = [
            ...self.scoreRules.map(rule => rule.value),
            ...(types.includes('bar') && baselineReached(origin, scaleType)
              ? [origin]
              : []),
          ]
          return visibleStatsRange({
            active: indices.some(i => self.markEntries[i]!.valued),
            view: self.host,
            payloadFor: index => {
              const data = self.scaleDataMap.get(index)
              return data && { index, data }
            },
            itemsFor: ({ index, data }) =>
              data.layers
                .filter(
                  (l, i) =>
                    folded.has(i) && l.count > 0 && Number.isFinite(l.yMin),
                )
                .map((layer): RegionLayer => ({ index, layer })),
            accumulate: entries =>
              computeSpanStats(layerSpans(entries, drawnKeys)),
            range: (stats, entries) =>
              widenRangeToRules(
                autoscaleDomainFromSpans({
                  stats,
                  quantile: domainQuantile,
                  spans: layerSpans(entries, drawnKeys),
                }),
                reached,
              ),
          })
        },
        /**
         * #getter
         */
        get domain() {
          return self.autoscaledDomain
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The px the y scale stands in from both ends of its band, one number
         * for the axis and every mark: room for the largest glyph or half the
         * thickest rule where only those draw, and none beside a bar, whose
         * top edge is its datum and wants the plot box itself. A text mark
         * labels what is drawn and moves nothing.
         */
        get valueInsetPx(): number {
          let inset = 0
          for (const i of self.drawingMarkIndices) {
            const type = self.markTypes[i]
            const size = self.markSizes[i]!
            if (type === 'point') {
              inset = Math.max(inset, pointInsetPx(size))
            } else if (type === 'rule') {
              inset = Math.max(inset, size / 2)
            } else if (type !== 'text') {
              return 0
            }
          }
          return inset
        },
        /**
         * #getter
         * The one y scale the chrome draws the axis from — `scales.y` resolved:
         * its type, its domain autoscaled where it pins nothing, its title as
         * the caption and its rules. Every mark reads the same pair.
         */
        get valueScales(): ValueScale[] {
          const { minimalTicks } = self
          const height = self.height
          const pointInset = this.valueInsetPx
          // One band per row where the marks stand in rows or a pinned
          // `rowHeight` sizes them, the scale ruling each on its own the way
          // the multi-wiggle display's does; the whole plot box otherwise.
          const { rowCount } = this
          const rowHeight = self.effectiveRowHeight
          const rowsTop = this.rowsTopOffset - self.scrollTop
          const band =
            rowCount > 1 || (self.drawsKeyedRows && self.rowHeight > 0)
              ? {
                  height: rowHeight,
                  offset: pointInset,
                  bandTops: Array.from(
                    { length: rowCount },
                    (_, row) => rowsTop + row * rowHeight,
                  ),
                }
              : {
                  height,
                  offset: YSCALEBAR_LABEL_OFFSET + pointInset,
                }
          return [
            {
              domain: self.domain,
              scaleType: self.scaleType,
              symlogConstant: self.symlogConstant,
              ...band,
              left: treeSidebarOffset(self),
              minimalTicks,
              caption: self.scaleTitle,
              rules: self.scoreRules,
              grid: self.grid,
            },
          ]
        },
        /**
         * #method
         * the fetch inputs SettingsInvalidate watches: each mark's encoding
         * and lanes, and the filters as transform steps, all evaluated in the
         * worker, and the `adapterOptions` each region resolves
         */
        rpcProps(): {
          layers: LayerRequest[]
          transform: TransformStep[]
          facet?: FacetSpec
          opts?: object
        } {
          const field = self.splitField
          const opts = self.adapterOptions
          return {
            ...(opts ? { opts } : {}),
            layers: self.layerRequests,
            transform: [
              ...self.configuredFilters().map(expr => ({
                type: 'filter' as const,
                expr,
              })),
              ...stepsOf(self.conf.transform, self.host.bpPerPx),
              ...(self.facet ? [] : self.facetSteps),
            ],
            ...(field === undefined
              ? {}
              : {
                  facet: {
                    field,
                    ...(self.facet && self.facetSteps.length > 0
                      ? { transform: self.facetSteps }
                      : {}),
                  },
                }),
          }
        },
        /**
         * #getter
         * bands a span stacks into: the facet's rows, one per row drawn under
         * `rows`, or else the highest `row` any loaded layer carries, plus one
         */
        get rowCount(): number {
          const { rowCount } = self.facetLayout
          if (rowCount > 0 || self.rowTable) {
            return Math.max(1, rowCount)
          }
          const { visible } = self.markView
          let highest = 0
          for (const data of self.rpcDataMap.values()) {
            highest = Math.max(highest, highestRow(data.layers, visible))
          }
          return highest + 1
        },
        /**
         * #getter
         * `rowCount`, under the name `useRowVirtualScroll`'s shift+wheel
         * resize divides the plot by.
         */
        get nrow(): number {
          return this.rowCount
        },
        /**
         * #getter
         * `RowHeightMixin`'s hook: the plot split between the rows.
         */
        get autoRowHeight(): number {
          return markRowHeightPx(
            axisPlotBox(self.height).plotHeight,
            this.rowCount,
          )
        },
        /**
         * #getter
         * Where the rows start, below the plot's top inset.
         */
        get rowsTopOffset(): number {
          return axisPlotBox(self.height).yTop
        },
        /**
         * #getter
         * The colour scale each mark paints through where its colour is
         * quantitative: a ramp over the domain the legend already unioned
         * across the regions, its middle stop a value, or a threshold's cuts
         * and the packed colour of each interval. Both ride uniforms, so a pan
         * that widens a domain or an edit that moves a cut uploads no instance
         * bytes and no table.
         */
        get paintScales(): (MarkColorScale | undefined)[] {
          const sections = this.legendSections
          return self.conf.marks.map((_, i) =>
            paintScaleOf(colorSection(sections, i)?.scale),
          )
        },
        /**
         * #getter
         * Each link mark's size scale: its declared ends, the open ones the
         * least and greatest the regions draw, so a value strokes at one width
         * in every region; undefined for a mark whose size names no field.
         * Over the drawn layers, as the colour ramp's domain is, so a hidden
         * section leaves the stroke widths the way it leaves the key.
         */
        get sizeScales(): (LinkSizeScale | undefined)[] {
          const payloads = [...self.scaleDataMap.values()]
          return self.conf.marks.map((_, i) => {
            let table: SizeScaleTable | undefined
            let lo = Infinity
            let hi = -Infinity
            for (const { layers } of payloads) {
              const next = layers[i]?.sizeScale
              if (!next) {
                continue
              }
              table ??= next
              lo = Math.min(lo, next.extent[0])
              hi = Math.max(hi, next.extent[1])
            }
            const { domain, pinned, scale, range } = table ?? {}
            return domain && pinned && scale && range
              ? {
                  // The open ends follow the union, the pinned ones the
                  // config, as a colour ramp's domain does.
                  domain: rampDomain(
                    pinned[0] ? domain[0] : undefined,
                    pinned[1] ? domain[1] : undefined,
                    [lo, hi],
                  ),
                  scale,
                  range,
                }
              : undefined
          })
        },
        /**
         * #getter
         * The view's displayed regions as a link's feet place through them
         * (`viewRegionTable`). Empty where no mark is a link, reading nothing
         * per frame.
         */
        get linkRegions(): readonly LinkRegion[] {
          return self.hasLinkMark ? viewRegionTable(self.host) : NO_LINK_REGIONS
        },
        /**
         * #getter
         * geometry and scale for the plot canvas, the same box the hit test
         * measures in
         */
        get renderState(): MarkRenderState {
          const canvasWidth = self.canvasWidthPx
          const canvasHeight = axisPlotBox(self.height).plotHeight
          const { scaleType } = self
          const scaleTypeY =
            scaleType === 'log' || scaleType === 'symlog' ? scaleType : 'linear'
          const { paintScales: colorScales } = this
          return resolveRenderState(self.domain, domainY => ({
            domainY,
            scaleTypeY,
            symlogConstantY: resolveSymlogConstant(
              domainY[0],
              domainY[1],
              self.symlogConstant,
            ),
            colorScales,
            canvasWidth,
            canvasHeight,
            bpPerPx: self.host.bpPerPx,
            origin: self.origin,
            minWidthPx: self.minWidthPx,
            markSizes: self.markSizes,
            sizeScales: this.sizeScales,
            linkRegions: this.linkRegions,
            valueInsetPx: this.valueInsetPx,
            rowHeight: self.effectiveRowHeight,
            rowProportions: self.markRowProportions,
            scrollTop: self.scrollTop,
            rowTable: self.rowTable,
          }))
        },
        /**
         * #getter
         * The mark the hover or the open context menu is on, or undefined.
         */
        get highlightedHit(): MarkHitInfo | undefined {
          return self.hoveredFeature ?? self.contextMenuInfo?.hit
        },
        /**
         * #getter
         * A ring around a point or a rule, since a wash over 4 px of ink is
         * invisible and every hue may be the colour scale's; a shade over
         * anything else.
         */
        get highlightStyle(): HighlightStyle {
          const type = this.highlightedHit
            ? self.markTypes[this.highlightedHit.markIndex]
            : undefined
          return type === 'point' || type === 'rule' ? 'ring' : 'shade'
        },
        /**
         * #getter
         * The box the hovered instance painted, for the chrome's highlight; the
         * context menu's hit stands in while a menu is open. In the chrome's px,
         * so the plot's inset is added to the canvas box. A ring wraps the ink
         * a fixed margin out, round a point and along a rule's whole length,
         * and floors at 6 px, so a tiny point stays findable.
         */
        get hoverInk(): HighlightRect[] {
          const hit = this.highlightedHit
          if (!hit) {
            return []
          }
          const top = this.rowsTopOffset
          const mark = self.markList.findIndex(
            m => m.markIndex === hit.markIndex,
          )
          if (mark === -1) {
            return []
          }
          const boxes = inkOfInstances(
            self.markList,
            self.renderBlocks,
            index => self.rpcDataMap.get(index),
            this.renderState,
            index =>
              index === hit.regionIndex
                ? [{ mark, index: hit.instance }]
                : undefined,
            [hit.regionIndex],
          ).map(r => shiftInk(r, 0, top))
          if (this.highlightStyle !== 'ring') {
            return boxes
          }
          const size = self.markSizes[hit.markIndex]!
          const r = Math.max(6, size / 2 + 4)
          const margin = r - size / 2
          return boxes.map(box => {
            const width = Math.max(2 * r, box.width + 2 * margin)
            const height = Math.max(2 * r, box.height + 2 * margin)
            return {
              left: box.left + (box.width - width) / 2,
              top: box.top + (box.height - height) / 2,
              width,
              height,
            }
          })
        },
        /**
         * #getter
         * What the declared marks say that the display cannot draw as written,
         * reported where a load would once have refused the track.
         */
        get configProblems(): MarkProblem[] {
          return markProblems({
            marks: getSnapshot(self.conf.marks),
            transform: getSnapshot(self.conf.transform) as StepSnapshot[],
            facet: getSnapshot(self.conf.facet) as FacetSnapshot,
            rows: getSnapshot(self.conf.rows) as RowsSnapshot,
            scales: getSnapshot(self.conf.scales) as ScalesSnapshot,
          })
        },
        /**
         * #method
         * What a draft plot would report once applied, as the lines `notices`
         * carries, without touching the display; one a config file would
         * refuse throws the refusal.
         */
        plotProblems(plot: MarkPlot): string[] {
          return markProblems(this.liftMarkPlot(plot)).map(problemText)
        },
        /**
         * #method
         * A draft as the rule list reads it, merged over `plot` and lifted by
         * the config schema, throwing what a config file would be refused
         * for. Nothing on this display is touched.
         */
        liftMarkPlot(plot: MarkPlot): MarkPlotSettings {
          return markPlotSettingsOf(self.liftPlot(plot))
        },
        /**
         * #getter
         * What the adapter said about the loaded regions that the plot cannot
         * show — an index SNP no LD record names — each once, for the corner
         * notice.
         */
        get dataNotices(): string[] {
          return [
            ...new Set(
              [...self.rpcDataMap.values()].flatMap(d => d.notices ?? []),
            ),
          ]
        },
        /**
         * #getter
         * The shape keys whose unlisted values collide on one shape, each
         * with the domain Pin distinct shapes writes.
         */
        get sharedKeys() {
          return sharedKeysOf(this.legendSections)
        },
        /**
         * #getter
         * The config problems as lines, `dataNotices`, and the keys whose
         * values collide: what the corner's problems notice lists. The
         * skipped count has a chip of its own.
         */
        get cornerNotices(): string[] {
          return [
            ...this.configProblems.map(problemText),
            ...this.dataNotices,
            ...this.sharedKeys.map(sharedKeyNotice),
          ]
        },
        /**
         * #getter
         * `cornerNotices` and a mark whose every loaded feature was skipped,
         * which a mistyped field is, as lines an agent's settle report
         * carries: a display with any of them still draws, so nothing else
         * reaches a caller that cannot see the corner.
         */
        get notices(): string[] {
          const { skipped, total, fields } = this.skippedFeatures
          return [
            ...this.cornerNotices,
            ...(total > 0 && skipped === total
              ? [
                  `every one of ${total.toLocaleString()} ${pluralize(total, 'feature')} was skipped: ${fields.join(', ') || 'start or end'} missing or not a number`,
                ]
              : []),
          ]
        },
        /**
         * #getter
         * The corner notice while the sidecar stands in, naming what is drawn
         * and how many marks are not: past the budget the banner is gone, and
         * nothing else on screen says the bars are the sidecar's.
         */
        get densityStandInNotice(): string | undefined {
          if (!self.coarseTierStandsIn) {
            return undefined
          }
          const off = self.markView.visible.filter(
            (visible, i) => visible && i !== self.densityMarkIndex,
          ).length
          const rest =
            off === 0
              ? ''
              : `; ${off} other ${pluralize(off, 'mark')} draws nothing`
          return `Too much data to fetch here, so the adapter's density sidecar is drawn in the features' place${rest}`
        },
        /**
         * #getter
         * What the worker left out of the loaded regions — a feature whose
         * position or `y` read as missing or not a number — for the corner
         * notice, naming the field a binned position came from.
         */
        get skippedFeatures(): SkippedFeatures {
          const { encodings } = self
          const { visible } = self.markView
          const positionFields = self.markStepLists.map((steps, i) => {
            const { x = 'start', x2 = 'end' } = encodings[i] ?? {}
            const x2Field = typeof x2 === 'object' ? x2.pos : x2
            return [
              ...new Set([
                positionSource(steps, x),
                positionSource(steps, x2Field),
              ]),
            ]
          })
          return skippedFeatures(
            [...self.rpcDataMap.values()].map(d =>
              d.layers
                .map((layer, i) => ({
                  count: layer.count,
                  skipped: layer.skipped,
                  skippedPosition: layer.skippedPosition,
                  field: encodings[i]?.y,
                  positionFields: positionFields[i],
                }))
                .filter((_, i) => visible[i]),
            ),
          )
        },
        /**
         * #getter
         * the colour keys the loaded regions carry, one per scale the marks
         * drawing at the view's zoom resolve through, each headed with its
         * channel's `title`
         */
        get legendSections() {
          const { visible } = self.markView
          const { marks } = self.conf
          return buildMarkLegend(
            self.scaleDataMap.values(),
            i => !!visible[i],
            (i, channel) => keySettingOf(marks[i], channel),
          )
        },
        /**
         * #getter
         * `LegendMixin`'s hook: the keys as color scales, so the chrome and the
         * export draw the legend off the tables the worker resolved
         */
        get colorScales() {
          return markColorScales(
            this.legendSections,
            self.facet
              ? categoricalField(self.facet.field, {
                  domain: self.facet.domain,
                })
              : self.drawsRows
                ? categoricalField(self.rowsField, {
                    domain: self.editableSources.map(row => row.name),
                  })
                : undefined,
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The px each row is drawn in, the band every shape gets:
         * `RowHeightMixin`'s under `rows`, pinned or fit. Elsewhere the bands
         * fit the plot whatever `rowHeight` holds, since a facet's rows and
         * the density sidecar's one band have no scroll to reach past the
         * plot's foot.
         */
        get effectiveRowHeight(): number {
          return resolveRowHeight(
            self.drawsKeyedRows ? self.rowHeight : 0,
            self.autoRowHeight,
          )
        },
        /**
         * #getter
         * `TrackHeightMixin`'s hook: the rows under `rows`, taller than the
         * plot wherever a pinned `rowHeight` asks for more than it holds.
         */
        get scrollContentHeight(): number {
          return self.drawsKeyedRows
            ? self.rowCount * self.effectiveRowHeight
            : 0
        },
        /**
         * #getter
         * `TrackHeightMixin`'s hook: the plot the rows scroll behind.
         */
        get scrollViewportHeight(): number {
          return axisPlotBox(self.height).plotHeight
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Write every span mark's `rowProportion`.
         */
        setRowProportion(n: number) {
          for (const mark of self.conf.marks) {
            if (mark.mark === 'span') {
              setConf(mark, 'rowProportion', n)
            }
          }
        },
        /**
         * #action
         * Fit the rows to the plot. The `height` getter is the slot itself,
         * so nothing needs seeding on the way in.
         */
        setFitToHeight() {
          setConf(self, 'rowHeight', 0)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The first mark drawing at this zoom that stands at a value: what a
         * row's value at a column is read from, and what clustering compares.
         * -1 where none does.
         */
        get valueMarkIndex(): number {
          return (
            self.drawingMarkIndices.find(i => readsValue(self.markTypes[i]!)) ??
            -1
          )
        },
        /**
         * #getter
         * The dendrogram positioned against the rows drawn, or undefined where
         * it no longer names them.
         */
        get hierarchy() {
          return computeClusterHierarchy(
            self.root,
            self.sources,
            self.sources.length * self.effectiveRowHeight,
            self.treeAreaWidth,
            self.showBranchLength,
          )
        },
        /**
         * #getter
         */
        get spatialIndex() {
          return buildSpatialIndex(this.hierarchy)
        },
        /**
         * #getter
         */
        get svgSidebar(): SvgSidebarProps | undefined {
          return self.drawsKeyedRows
            ? {
                showTree: self.showTree,
                hierarchy: this.hierarchy,
                sources: self.sources,
                rowHeight: self.effectiveRowHeight,
                treeAreaWidth: self.treeAreaWidth,
                showLabels: self.showRowLabels,
                leftInset: leftAxisGutterWidth(self.axes),
              }
            : undefined
        },
      }))
      .volatile(self => ({
        // The fields a scan of the features found, and whether the default rule
        // has already had its turn. Volatile: a field list describes the data,
        // not the session, and a reload scans again.
        plotFields: undefined as PlotFields | undefined,
        plotFieldsError: undefined as unknown,
        plotDefaultChecked: false,
        plotFieldsPromise: undefined as Promise<PlotFields> | undefined,
        plotScanned: [] as Region[],
        // The click-driven details fetch, lent the display's status window so
        // it reports through the same chip as the viewport fetch and a second
        // click supersedes the first.
        detailsRotation: createAbortRotation(self, {
          statusWindow: self.statusWindow,
        }),
        plotScanRotation: createAbortRotation(self, {
          statusWindow: self.statusWindow,
        }),
      }))
      .views(self => ({
        /**
         * #getter
         * The window the held field scan read, for the dialog to name.
         */
        get plotScanLocus(): string | undefined {
          const [region] = self.plotScanned
          return region
            ? assembleLocString({
                refName: region.refName,
                start: region.start,
                end: region.end,
              })
            : undefined
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Open the feature widget on the read, the bin or the run a hit drew,
         * inside its facet section, through `selectEncodedFeature`. A bin of the
         * density sidecar opens nothing, its region holding no request — the
         * read-back is the download the gate refused.
         */
        selectFeature(hit: MarkHitInfo) {
          const request = self.featurePayloads.get(hit.regionIndex)?.request
          if (request) {
            selectEncodedFeature(self, self.detailsRotation, {
              ...request,
              layer: hit.markIndex,
              featureIndex: hit.featureIndex,
            })
          }
        },
        /**
         * #action
         * Stage a region as fetched, with this display's payload layout.
         */
        setRpcData(idx: number, data: EncodedLayersResult, region: Region) {
          const { byteLimit, ...request } = rpcArgs(self)
          self.setLoadedRegion(idx, region, {
            ...storedRegionData(data),
            request: { ...request, region },
          })
        },
        /**
         * #action
         * The Sections menu's reorder lands on the declaration.
         */
        setFacetDomain(domain: string[]) {
          if (self.facet) {
            setConf(self.conf, ['facet', 'domain'], domain)
          }
        },
        /**
         * #action
         * A field's own bands, in their sorted order: the outgoing field's
         * domain goes with it, and the facet's steps stay.
         */
        setFacetField(field: string) {
          if (self.facet?.field !== field) {
            setConf(self.conf, ['facet', 'field'], field)
            setConf(self.conf, ['facet', 'domain'], [])
          }
        },
        /**
         * #action
         * A row per source where the adapter lists several and nothing splits
         * the features yet: one value per row is the row axis, and a facet is
         * for bands holding more than one row.
         */
        splitByPlotRows(fields: PlotFields) {
          if (fields.rows && self.splitField === undefined) {
            setConf(self.conf, ['rows', 'field'], fields.rows)
          }
        },
        /**
         * #action
         * Order the rows by the value each stands at over (refName, pos),
         * highest first, off the loaded regions with no refetch; false where no
         * loaded region covers the column.
         */
        sortRowsByValueAt(refName: string, pos: number) {
          const mark = self.valueMarkIndex
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => (mark === -1 ? undefined : self.rpcDataMap.get(index)),
            (rows, region) => {
              const { rowKeys, rowTable } = self
              const byName = new Map<string, number>()
              for (const [key, value] of rowValuesAt(region, mark, pos)) {
                const name =
                  rowTable && keySlot(key, rowTable) !== undefined
                    ? rowKeys.names[key]
                    : undefined
                if (name !== undefined) {
                  byName.set(name, value)
                }
              }
              return orderRowsByValueAt(rows, byName, (a, b) => b - a)
            },
          )
        },
        /**
         * #action
         * Write the `filter` slot; undefined returns it to what the track's
         * config declares.
         */
        setFilter(filters?: string[]) {
          setConf(self, 'filter', filters ?? self.baseFilters())
        },
        /**
         * #action
         */
        setPlotFields(fields?: PlotFields, error?: unknown) {
          self.plotFields = fields
          self.plotFieldsError = error
        },
        /**
         * #action
         */
        setPlotDefaultChecked() {
          self.plotDefaultChecked = true
        },
        setPlotFieldsPromise(
          promise?: Promise<PlotFields>,
          scanned: Region[] = [],
        ) {
          self.plotFieldsPromise = promise
          self.plotScanned = scanned
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Scan the features for the fields a plot can read. A scan that found a
         * numeric field answers for the display's life; one that found none
         * answers only for the window it read, and a failed one for nothing. A
         * scan a newer one aborted answers with the newer one's fields.
         */
        ensurePlotFields() {
          const regions = plotScanRegions(self.host, onTrackAssembly(self))
          const held = self.plotFieldsPromise
          if (
            held &&
            ((self.plotFields?.numeric.length ?? 0) > 0 ||
              deepEqual(regions, self.plotScanned))
          ) {
            return held
          }
          const pending = scan()
          self.setPlotFieldsPromise(pending, regions)
          return pending

          async function scan(): Promise<PlotFields> {
            const active = self.plotScanRotation.begin()
            self.setPlotFields(undefined)
            try {
              const fields = await fetchPlotFields({
                self,
                regions,
                opts: {
                  signal: active.signal,
                  statusCallback: active.statusCallback,
                },
              })
              if (active.isCurrent()) {
                self.setPlotFields(fields)
              }
              return fields
            } catch (error) {
              const successor = self.plotFieldsPromise
              if (!active.isCurrent() && successor && successor !== pending) {
                return successor
              }
              if (active.isCurrent()) {
                self.setPlotFields(undefined, error)
                self.setPlotFieldsPromise(undefined)
              }
              throw error
            } finally {
              active.end()
            }
          }
        },
        /**
         * #action
         * Open the plot as text, over the same settings the controls write.
         * `seed` overlays a setting the caller has in hand but has not
         * applied.
         */
        openPlotDialog(seed?: MarkPlot) {
          queuePlotDialog(self, seed)
        },
        /**
         * #action
         * Write every point mark's `encoding.size` number; undefined returns
         * each to the default.
         */
        setPointSize(val?: number) {
          for (const mark of self.conf.marks) {
            if (mark.mark === 'point') {
              setConf(mark, ['encoding', 'size', 'value'], val)
            }
          }
        },
        /**
         * #action
         * The categorical analogue of the min/max dialog's "Use current
         * range": every value a colliding shape key lists goes into the
         * shape's `domain`, in key order after what it already lists, so each
         * takes a shape of its own.
         */
        pinDistinctShapes() {
          for (const key of self.sharedKeys) {
            for (const i of key.markIndexes) {
              setConf(
                self.conf.marks[i]!,
                ['encoding', 'shape', 'domain'],
                key.pinned,
              )
            }
          }
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Open the plot as controls: every mark, the channels its type reads,
         * and what the rules say under each. The field scan runs behind it, as
         * it does for the field dialog.
         */
        openMarkPlotDialog(seed?: MarkPlot) {
          void self.ensurePlotFields().catch(() => {})
          getDialogHost(self).queueDialog(handleClose => [
            MarkPlotDialog,
            { model: self, seed, handleClose },
          ])
        },
        /**
         * #action
         * The text box's "Back to form", opened on its draft.
         */
        openPlotForm(draft: MarkPlot) {
          this.openMarkPlotDialog(draft)
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          return markTrackMenuItems(self as LinearMarkDisplayModel)
        },
        /**
         * #method
         */
        contextMenuItems(): MenuItem[] {
          return markContextMenuItems(self as LinearMarkDisplayModel)
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        fetchNeeded(needed: IndexedRegion[]) {
          const { bpPerPx, displayedRegions } = self.host
          const { transform, facet } = self.rpcProps()
          const step = widestBinStep([
            ...transform,
            ...(facet?.transform ?? []),
            ...self.conf.marks.flatMap(m => stepsOf(m.transform, bpPerPx)),
          ])
          const regions =
            step > 0
              ? needed.map(n => ({
                  ...n,
                  region: toBinEdges(
                    n.region,
                    step,
                    displayedRegions[n.displayedRegionIndex]!,
                  ),
                }))
              : needed
          const { byteLimit, opts, ...request } = {
            ...rpcArgs(self),
            bpPerPx,
          }
          return fetchEachRegion(self, regions, {
            call: async (region, ctx) => {
              const resolved =
                opts &&
                (await self.resolveAdapterOptions(opts, region, ctx.signal))
              const asked = {
                ...request,
                region,
                ...(resolved ? { opts: resolved } : {}),
              }
              const result = await ctx.callRpc('CoreGetEncodedLayers', {
                ...asked,
                byteLimit,
              })
              return isRegionRefused(result) ? result : { result, asked }
            },
            onResult: (_idx, { result, asked }) => ({
              ...storedRegionData(result),
              request: asked,
            }),
          })
        },
        /**
         * #action
         * identity encode — the stored payload is what the backend uploads
         */
        startRenderingBackend(backend: MarkRenderingBackend) {
          installUpload(self, backend, {
            cells: () => self.rpcDataMap,
            render: b =>
              b.renderBlocks(
                self.renderBlocks,
                self.rpcDataMap,
                self.renderState,
              ),
          })
        },
      }))
      .actions(self => ({
        afterAttach() {
          installPrerequisiteFetch(self, {
            name: 'MarkRowSources',
            delay: 0,
            report: { setStatusMessage: () => {} },
            gate: () => self.drawsRows,
            run: (adapterConfig, ctx) =>
              ctx.callRpc('MarkGetRowSources', { adapterConfig }),
            commit: read => {
              self.setSourceListing(read)
            },
            setError: error => {
              if (error !== undefined) {
                console.warn(
                  `Could not list the adapter's sources; rows come from the features alone: ${error}`,
                )
              }
            },
          })
          setupTreeSidebarAutoruns(self, {
            name: 'Mark',
            sortRows: (refName, pos) => self.sortRowsByValueAt(refName, pos),
            clustering: {
              ready: () =>
                self.clusterableSources.length > 1 &&
                self.valueMarkIndex !== -1,
              run: async args => {
                const { runMarkClustering } =
                  await import('./runMarkClustering.ts')
                await runMarkClustering({ model: self, ...args })
              },
            },
          })
          // Nothing declared draws nothing, and the Display types menu offers
          // this display on every feature, alignments and variant track. So the
          // first time it is shown with an empty `marks`, the features decide
          // (`defaultPlot`), or the dialog opens where they decide nothing.
          addDisposer(
            self,
            autorun(async () => {
              if (
                self.plotDefaultChecked ||
                !self.host.initialized ||
                self.conf.marks.length > 0
              ) {
                return
              }
              self.setPlotDefaultChecked()
              const fields = await self
                .ensurePlotFields()
                .catch(() => undefined)
              if (!isAlive(self) || !fields || self.conf.marks.length > 0) {
                return
              }
              const plot = defaultPlot(fields)
              if (plot) {
                setConf(self.conf, 'marks', plot.marks)
                if (plot.zero === false) {
                  self.setScaleZero(false)
                }
                self.splitByPlotRows(fields)
              } else {
                self.openMarkPlotDialog()
              }
            }),
          )
        },
        /**
         * #action
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
  )
}

export type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
export type { FacetLayout } from './facet.ts'
export type { MarkHitInfo } from './findMarkHit.ts'
export type { MarkLegendSection } from './legend.ts'
export type {
  DisplayMark,
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  TextMarkEntry,
} from './markList.ts'
export type { MarkPlot, MarkPlotSettings } from './markPlot.ts'
export type { MarkProblem } from './markProblems.ts'
export type { PlotFields } from './scanPlotFields.ts'
export type { StepChannels } from './stepChannels.ts'

export type LinearMarkDisplayStateModel = ReturnType<typeof stateModelFactory>
export interface LinearMarkDisplayModel extends Instance<LinearMarkDisplayStateModel> {}
