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
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { rampDomain } from '@jbrowse/core/util/colorRamp'
import { IDENTITY_SCALE } from '@jbrowse/core/util/colorScale'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import {
  isExpressionEntry,
  predicatesOf,
  unreadFieldNotice,
  unreadInEveryRegion,
} from '@jbrowse/core/util/fieldPredicate'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'
import {
  installPrerequisiteFetch,
  isCurrentRead,
  readFor,
} from '@jbrowse/core/util/installPrerequisiteFetch'
import {
  baseJexlFilters,
  configuredJexlFilters,
  writeJexlFilters,
} from '@jbrowse/core/util/jexlFilters'
import { withHitIndex } from '@jbrowse/core/util/markEncoding'
import { resolveRowHeight } from '@jbrowse/core/util/resolveRowHeight'
import { selectEncodedFeature } from '@jbrowse/core/util/selectEncodedFeature'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import FacetWritesMixin from '@jbrowse/display-kit/FacetWritesMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import {
  colorSettingOf,
  featureColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
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
  TEXT_BASELINE_RATIO,
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
  orderRowsByValueAt,
  setupTreeSidebarAutoruns,
  sortRowsAtColumn,
  sidebarPanelWidth,
} from '@jbrowse/tree-sidebar'
import {
  ROW_GROUP_FIELD,
  compileRowGroups,
  tagRowGroups,
} from '@jbrowse/tree-sidebar/rowGroups'
import {
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

import {
  facetLayout,
  rowsLayout,
  sectionsInWindow,
  sectionsOn,
  unsplitRegion,
} from './facet.ts'
import { instancesOfFeature } from './featureInstances.ts'
import { fetchPlotFields, plotScanRegions } from './fetchPlotFields.ts'
import { sameMarkHit } from './findMarkHit.ts'
import { paintedColorNode, saysColor } from './inheritedColor.ts'
import {
  buildMarkLegend,
  colorSection,
  keySettingOf,
  markColorScales,
  paintScaleOf,
} from './legend.ts'
import { createLinkOwners, withMateRegions } from './linkOwners.ts'
import { baselineReached, layerSpans } from './markAutoscale.ts'
import { markColorOf, withMarkColors } from './markColor.ts'
import {
  MIN_MARK_WIDTH_PX,
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
  withRootLane,
  positionSource,
  stepsOf,
  toBinEdges,
  widestBinStep,
} from './markRequest.ts'
import { markSizePx, pxChannelOf } from './markSpecs.ts'
import { DEFAULT_POINT_DIAMETER_PX } from './markVocabulary.ts'
import { MARK_Y_PATHS } from './markYPaths.ts'
import { sharedKeyNotice, sharedKeysOf } from './pinDistinct.ts'
import { defaultPlot } from './plotDefault.ts'
import { withRowColors } from './rowColors.ts'
import {
  byCategoryBlocks,
  categoriesByColor,
  rowCompareLabel,
  rowCompareOf,
} from './rowCompare.ts'
import {
  drawnKeysOf,
  drawnRegion,
  facetRowName,
  facetRowTable,
  keyRegion,
  listingNamesRows,
  markRowTable,
  sectionRowName,
} from './rowTable.ts'
import { stepChannels } from './stepChannels.ts'
import { TEXT_MARK_FONT_PX, placeTextMarks } from './textMarks.ts'

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
import type { ColorSource, HiddenCategory } from './markColor.ts'
import type {
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  TextMarkEntry,
} from './markList.ts'
import type { MarkPlot, MarkPlotSettings } from './markPlot.ts'
import type { MarkProblem, MarkSnapshot } from './markProblems.ts'
import type { DefaultPlot } from './plotDefault.ts'
import type { RowColors } from './rowColors.ts'
import type { RowCompare } from './rowCompare.ts'
import type { RowKeySpace } from './rowTable.ts'
import type { JoinedPlotFields, PlotFields } from './scanPlotFields.ts'
import type { StepChannels } from './stepChannels.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  PlotWriteOptions,
} from '@jbrowse/core/configuration'
import type {
  ListedRowSource,
  RowSourceListing,
} from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { MenuItem } from '@jbrowse/core/ui'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
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
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { FloatingLabel } from '@jbrowse/display-kit/floatingLabelHost'
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
import type {
  RowBanding,
  RowSource,
  SvgSidebarProps,
} from '@jbrowse/tree-sidebar'
import type { RowGroup } from '@jbrowse/tree-sidebar/rowGroups'
import type { ValueScale } from '@jbrowse/wiggle-core'

export type MarkRenderingBackend = PerRegionRenderingBackend<
  MarkRegionData,
  MarkRenderState
>

const MarkPlotDialog = lazy(() => import('./components/MarkPlotDialog.tsx'))

const NO_REGIONS: ReadonlyMap<number, MarkRegionData> = new Map()

// What the rule list reads beside the plot: the row attributes a config
// gives its rows, `group` where `rowGroups` declares any, and the display's
// own `encoding.color`.
type MarkColorSnapshot = NonNullable<MarkSnapshot['encoding']>['color']

function plotContextOf(conf: AnyConfigurationModel) {
  const { encoding } = getSnapshot<{
    encoding?: { color?: MarkColorSnapshot }
  }>(conf)
  return { rowAttributes: rowAttributesOf(conf), color: encoding?.color }
}

// The row attributes a config gives its rows: `group` where `rowGroups`
// declares any.
function rowAttributesOf(conf: AnyConfigurationModel): readonly string[] {
  const { rowGroups = [] } = getSnapshot<{ rowGroups?: unknown[] }>(conf)
  return rowGroups.length > 0 ? [ROW_GROUP_FIELD] : []
}
const NO_JOINED_FIELDS: JoinedPlotFields = { numeric: [], categorical: [] }
const NO_LINK_REGIONS: readonly LinkRegion[] = []

function storedRegionData(result: EncodedLayersResult): MarkRegionData {
  return {
    layers: result.layers.map(layer => withHitIndex(layer)),
    facet: result.facet,
    zoomRange: result.zoomRange,
    notices: result.notices,
    facts: result.facts,
    unreadFilterFields: result.unreadFilterFields,
  }
}

// A mark's px, its `encoding.size` or `encoding.strokeWidth` number by its
// type, or its type's default where none is written.
function markSizeOf({ mark, encoding }: Pick<MarkConfig, 'mark' | 'encoding'>) {
  const px = pxChannelOf(mark.type)
  return markSizePx(mark.type, px && encoding[px].value)
}

// A span with a height: one at band 0 draws a line, as a spliced feature's
// does under its blocks, and Row height leaves it a line.
function isSizedRect({ mark }: Pick<MarkConfig, 'mark'>) {
  return mark.type === 'rect' && mark.height.band > 0
}

/** The marks at the view's zoom: which draw. */
export interface MarkView {
  visible: boolean[]
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
        ScoreScaleMixin(MARK_Y_PATHS),
        LegendMixin(),
        ContextMenuMixin<MarkDisplayContextMenuInfo>(),
        StoredHoverMixin<MarkHitInfo>(sameMarkHit),
        HiddenGroupsMixin(),
        FacetWritesMixin(),
        // #region configRef
        types.model({
          type: types.literal('LinearMarkDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          // #endregion
          /**
           * #property
           * The categories the key's rows hide, each a value of the field a
           * categorical color reads or a color an identity key lists: session
           * state the Categories menu toggles, applied where the colors
           * resolve, so a toggle refetches nothing. Kept across a field
           * change and live again when the field comes back.
           */
          hiddenCategories: types.frozen<
            readonly HiddenCategory[] | undefined
          >(),
        }),
      )
      .views(() => ({
        /**
         * #getter
         * Opt into the byte gate: `CoreGetEncodedLayers` measures the index before
         * it downloads, so an over-budget region is refused before a feature is
         * read.
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
         * #method
         * Overridable hook: what the display draws with nothing declared, off
         * the scanned fields, or undefined where they decide nothing and the
         * plot dialog opens instead.
         */
        defaultPlotOf(fields: PlotFields): DefaultPlot | undefined {
          return defaultPlot(fields)
        },
        /**
         * #getter
         * Overridable hook: whether the track menu offers the scanned fields,
         * so a declared plot still scans, and rescans while it holds none.
         */
        get menusOfferPlotFields(): boolean {
          return false
        },
        /**
         * #getter
         * Overridable hook: the fields `adapterOptions` has the adapter write
         * onto a feature, which Edit plot offers beside the ones a scan of the
         * file found. Manhattan's LD join writes two.
         */
        get joinedPlotFields(): JoinedPlotFields {
          return NO_JOINED_FIELDS
        },
        /**
         * #getter
         * The declared marks' types, in draw order.
         */
        get markTypes(): MarkType[] {
          return self.conf.marks.map(m => m.mark.type)
        },
        /**
         * #getter
         * The `facet` object as written, or undefined while unfaceted.
         */
        get declaredFacet(): FacetSetting | undefined {
          return facetSettingOf({
            field: getConf(self, ['facet', 'field']),
            sort: getConf(self, ['facet', 'sort']),
          })
        },
        /**
         * #getter
         * The `rowGroups` entries, each slot filled in.
         */
        get rowGroups(): RowGroup[] {
          return getSnapshot<Partial<RowGroup>[]>(self.conf.rowGroups).map(
            ({ match = '', group = '' }) => ({ match, group }),
          )
        },
        /**
         * #getter
         * The fields a row carries beside its name, which a facet bands the
         * rows by: `group` where `rowGroups` declares groups. Config alone, so
         * whether a facet bands or splits is known before a feature loads.
         */
        get rowAttributeFields(): readonly string[] {
          return rowAttributesOf(self.conf)
        },
        /**
         * #getter
         * Whether the facet stacks the rows in bands: `rows` drawn and the
         * facet on a row attribute.
         */
        get bandsRows(): boolean {
          const facet = this.declaredFacet
          return (
            !!facet &&
            getConf(self, ['rows', 'field']) !== '' &&
            this.rowAttributeFields.includes(facet.field)
          )
        },
        /**
         * #getter
         * The facet the worker splits the features into sections by:
         * `declaredFacet`, unless it bands the rows, which are split by
         * `rows` alone and banded here.
         */
        get facet(): FacetSetting | undefined {
          return this.bandsRows ? undefined : this.declaredFacet
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
         * names a `y` and whether its color is written, a constant or a
         * scale. Its own getter so a slot only a label reads never remakes
         * the mark list.
         */
        get textMarkEntries(): TextMarkEntry[] {
          const { marks } = self.conf
          return this.markEntries.map((entry, i) => {
            const color = colorSettingOf(
              paintedColorNode(marks[i]!, self.conf.encoding.color),
            )
            return {
              ...entry,
              ownColor:
                featureColorEncoding(color) !== undefined ||
                color.scale.type === IDENTITY_SCALE,
            }
          })
        },
        /**
         * #getter
         * The marks at the view's zoom: whether each draws, inside its
         * `minBpPerPx`..`maxBpPerPx` range where 0 is no bound.
         */
        get markView(): MarkView {
          const { bpPerPx } = self.host
          return {
            visible: this.markEntries.map(entry => markDrawsAt(entry, bpPerPx)),
          }
        },
        /**
         * #getter
         * Each mark's px, a point's `encoding.size` or a stroked mark's
         * `encoding.strokeWidth` number, its type's default where none is
         * written, and 0 for a bar, span or text, which draw none.
         */
        get markSizes(): number[] {
          return self.conf.marks.map(markSizeOf)
        },
        /**
         * #getter
         * Each mark's `mark.height.band`, which a span alone reads.
         */
        get markRowProportions(): number[] {
          return self.conf.marks.map(m => m.mark.height.band)
        },
        /**
         * #getter
         * The proportion the Row height dialog shows: the first sized span's,
         * or undefined where no span has a height, so the dialog asks for none.
         */
        get rowProportion(): number | undefined {
          return self.conf.marks.find(isSizedRect)?.mark.height.band
        },
        /**
         * #getter
         * Whether any mark is a link, whose feet place through the view's
         * regions rather than the block's own range.
         */
        get hasLinkMark(): boolean {
          return self.conf.marks.some(m => m.mark.type === 'link')
        },
        /**
         * #getter
         * The size the Point size menu shows: the first point mark's, or the
         * default where no mark is a point.
         */
        get pointSize(): number {
          const first = self.conf.marks.find(m => m.mark.type === 'point')
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
         * The steps every mark runs before its own `transform`: the
         * display's, then the facet's.
         */
        get sharedSteps(): MarkTransformStepConfig[] {
          return [...self.conf.transform, ...self.conf.facet.transform]
        },
        /**
         * #getter
         * The steps that run before each mark's encode, in order: the
         * display's, the facet's, then the mark's own.
         */
        get markStepLists(): MarkTransformStepConfig[][] {
          return self.conf.marks.map(m => [...this.sharedSteps, ...m.transform])
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
         * Where each mark's color comes from (`markColor.ts`), read from the
         * config alone, so editing a color recolors the loaded regions
         * rather than fetching them again.
         */
        get markColors(): ColorSource[] {
          const { markChannels } = this
          return self.conf.marks.map((m, i) =>
            markColorOf(
              m,
              markChannels[i]!,
              self,
              self.hiddenCategories,
              self.conf.encoding.color,
            ),
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
            markLayerRequest(
              m,
              markChannels[i]!,
              bpPerPx,
              binEdges,
              self.conf.encoding.color,
            ),
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
         * The `jexl:` expressions the `filter` list holds.
         */
        get configuredFilters() {
          return () => configuredJexlFilters(self)
        },
        /**
         * #getter
         * The `filter` list as the worker's steps: each expression its own
         * step, and the field tests one step of predicates.
         */
        get filterSteps(): TransformStep[] {
          const entries = predicatesOf(self.configuration.filter)
          const predicates = entries.filter(p => !isExpressionEntry(p))
          return [
            ...entries
              .filter(isExpressionEntry)
              .map(p => ({ type: 'filter' as const, expr: p.field })),
            ...(predicates.length > 0
              ? [{ type: 'filter' as const, predicates }]
              : []),
          ]
        },
        /**
         * #getter
         * The expressions the track's config declares, which "Clear all
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
        /**
         * #getter
         * Whether a line runs between rows, `axis.grid`.
         */
        get showRowSeparators(): boolean {
          return getConf(self, ['axis', 'grid'])
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Whether the display draws one row per value: a `rows` field and no
         * `facet` splitting the features, which draws in the rows' place.
         */
        get drawsRows(): boolean {
          return self.rowsField !== '' && !self.facet
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
         * The `rowGroups` entries whose `match` compiles.
         */
        get rowGroupMatchers() {
          return compileRowGroups(self.rowGroups)
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the facet's bands where it bands the
         * rows, its `sort` first and then the `rowGroups` groups in the order
         * they are declared.
         */
        get rowBanding(): RowBanding | undefined {
          const facet = self.declaredFacet
          return self.bandsRows && facet
            ? {
                field: facet.field,
                sort: [...facet.sort, ...self.rowGroups.map(g => g.group)],
              }
            : undefined
        },
        /**
         * #method
         * `TreeSidebarMixin`'s hook: each row tagged with the group of the
         * first `rowGroups` entry its name matches.
         */
        expandRows(rows: RowSource[]): RowSource[] {
          return tagRowGroups(rows, this.rowGroupMatchers)
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The layers as they came back, keyed by displayedRegionIndex: the
         * foundation's per-region store.
         */
        get featurePayloads(): ReadonlyMap<number, MarkRegionData> {
          return self.regionPayloads as ReadonlyMap<number, MarkRegionData>
        },
      }))
      .volatile(() => ({
        /**
         * #volatile
         * The latest `MarkGetRowSources` answer, stamped with the adapter
         * config it answers; null where the adapter lists none or the read
         * failed.
         */
        sourceListing: undefined as
          | AdapterRead<RowSourceListing | null>
          | undefined,
      }))
      .actions(self => ({
        /**
         * #action
         */
        setSourceListing(read: AdapterRead<RowSourceListing | null>) {
          self.sourceListing = read
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The adapter's row listing where it names the rows drawn: its field
         * is `rows.field`, or the key a `flatten` in the shared steps wrote
         * over its field. Undefined for an adapter that lists no rows, for one
         * that lists another field, and until the listing for the current
         * adapter config arrives.
         */
        get rowListing(): RowSourceListing | undefined {
          const listing = readFor(self, self.sourceListing)
          return listing &&
            listingNamesRows(self.rowsField, listing.field, self.sharedSteps)
            ? listing
            : undefined
        },
        /**
         * #getter
         * The current adapter config's row listing has landed or failed, or
         * this display draws no rows from one.
         */
        get rowListingSettled(): boolean {
          return !self.drawsRows || isCurrentRead(self, self.sourceListing)
        },
        /**
         * #getter
         * True until the row listing settles, since the listing adds rows to
         * the ones the features name and reorders them.
         */
        get dataSuperseded(): boolean {
          return !this.rowListingSettled
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
          const shown = self.trackVisibleRegions
          for (const [index, region] of self.featurePayloads) {
            const spans = shown.filter(b => b.displayedRegionIndex === index)
            const sections =
              shown.length === 0
                ? (sectionsOn(region, self.rowsField) ?? [])
                : sectionsInWindow(region, self.rowsField, spans)
            for (const { key } of sections) {
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
           * rows' field, in its order and with its label and color, so a
           * source with nothing in the loaded regions keeps its row; then the
           * other values the worker split the loaded regions on that have an
           * instance on screen, in the order the field's sections stack. The
           * fetch reaches past the screen on each side, and a row it met only
           * there would stand empty.
           */
          get discoveredRows(): RowSource[] {
            return discoveredRows.get()
          },
        }
      })
      .views(self => {
        let keySpace: RowKeySpace & { space: string } = {
          space: '',
          rowKeys: new RowKeys(),
          rowName: sectionRowName,
        }
        return {
          /**
           * #getter
           * The key each row holds across every loaded region, assigned at
           * its first arrival and never moved, and the name it is keyed by:
           * under `rows` its section's value, under a facet that value and
           * the row's depth in it. A new split field, or a switch between
           * `rows` and a facet, is a new key space.
           */
          get rowKeySpace(): RowKeySpace {
            const rows = self.drawsRows
            const space = `${rows ? 'rows' : 'facet'}:${self.splitField ?? ''}`
            if (keySpace.space !== space) {
              keySpace = {
                space,
                rowKeys: new RowKeys(),
                rowName: rows ? sectionRowName : facetRowName,
              }
            }
            return keySpace
          },
          /**
           * #getter
           * `rowKeySpace`'s keys.
           */
          get rowKeys(): RowKeys {
            return this.rowKeySpace.rowKeys
          },
        }
      })
      .views(self => {
        const layout = stableIdentityComputed(() => {
          if (self.drawsRows) {
            return rowsLayout(self.sources, categoricalField(self.rowsField))
          }
          const { field = '', sort: domain = [] } = self.facet ?? {}
          return facetLayout(
            self.featurePayloads.values(),
            categoricalField(field, { domain }),
            self.hiddenGroupKeys,
            self.markView.visible,
          )
        })
        // A fresh array per read would recolor every region on each read
        // nothing observes, so an equal one keeps the last one's identity.
        const sameColors = sameAsLast<ColorSource[]>()
        // Each region is colored here, first, so the rows, the sections, the
        // legend and the painters all read its colors as if the worker had
        // sent them.
        const colored = createEncodeMemo(
          () => self.featurePayloads,
          () => sameColors(self.markColors),
          withMarkColors,
        )
        const keyed = createEncodeMemo(
          () => (self.splitField === undefined ? NO_REGIONS : colored()),
          () => self.rowKeySpace,
          (region, { rowKeys, rowName }) =>
            keyRegion(region, rowKeys, self.splitField ?? '', rowName),
        )
        const unsplit = createEncodeMemo(
          () => (self.splitField === undefined ? colored() : NO_REGIONS),
          undefined,
          unsplitRegion,
        )
        // A mark naming no color, under a display naming none, paints each
        // row in the row's color where the row has one, and so does a
        // categorical color over the rows' own field (ADR-251).
        const rowColorPaint = stableIdentityComputed(
          (): RowColors | undefined => {
            if (!self.drawsRows || !self.rowColorPaintsMarks) {
              return undefined
            }
            const field = self.rowsField
            const declared = saysColor(self.conf.encoding.color)
            const marks = self.conf.marks.map((m, i) => {
              const source = self.markColors[i]
              return (
                (!declared && !saysColor(m.encoding.color)) ||
                (source?.kind === 'categories' &&
                  source.encoding.field === field)
              )
            })
            const colors = self.resolvedRowColors
            return marks.includes(true) && colors.size > 0
              ? { marks, colors, field }
              : undefined
          },
        )
        const rowColored = createEncodeMemo(
          () => keyed(),
          () => rowColorPaint.get(),
          (region, colors) =>
            colors
              ? withRowColors(region, colors, self.rowKeySpace.rowKeys.names)
              : region,
        )
        const drawn = () =>
          self.splitField === undefined ? unsplit() : rowColored()
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
           * The layers the display draws. Under a facet or `rows` every row
           * is a key the row table places, so a chip and the band beside it
           * agree whichever region a span came from, and a reorder, a focus,
           * a hidden section or a deeper section moves no instance. A region
           * is keyed again only when it or the key space moves, which is what
           * the upload re-packs.
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
          return self.rowKeySpace.rowKeys.names.slice()
        })
        const order = stableIdentityComputed(() =>
          self.sources.map(row => row.name),
        )
        return {
          /**
           * #getter
           * The table every mark places a key through: under `rows` its slot
           * in the rows' order, hidden where the focus leaves it out; under a
           * facet its section's first row plus its depth, hidden with its
           * section. Rebuilt on a reorder, a focus, a hidden or deeper section
           * or a new row, which uploads one small texture and no instance
           * bytes. Undefined while nothing splits the features.
           */
          get rowTable(): RowTable | undefined {
            return self.drawsRows
              ? markRowTable(keyNames.get(), order.get())
              : self.facet
                ? facetRowTable(keyNames.get(), self.facetLayout)
                : undefined
          },
        }
      })
      .views(self => {
        const drawnKeys = stableIdentityComputed(() => {
          const table = self.rowTable
          const { rowKeys, rowName } = self.rowKeySpace
          return (
            table &&
            drawnKeysOf(
              table,
              self.rpcDataMap.values(),
              rowKeys,
              self.splitField ?? '',
              rowName,
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
           * loaded region has is drawn: a focus or a hidden section moves it,
           * a reorder does not.
           */
          get drawnKeys(): Uint8Array | undefined {
            return drawnKeys.get()
          },
          /**
           * #getter
           * `rpcDataMap` with each layer's key and extents over the instances
           * the row table draws, its lanes shared: what the legend, the axis
           * and the size scales read, so a row the focus or a hidden section
           * hides leaves them as it leaves the plot.
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
         * the fence `encoding.y.scale` names, widened to every rule the scale
         * declares and to the origin whenever a bar mark draws, or undefined
         * before any valued mark loads
         */
        get autoscaleRange() {
          const indices = self.drawingMarkIndices
          const folded = new Set(indices)
          const types = indices.map(i => self.markTypes[i]!)
          const { origin, fenceQuantile, drawnKeys, scaleType } = self
          const reached = [
            ...self.scoreRules.map(rule => rule.value),
            ...(types.includes('bar') ? [origin] : []),
          ].filter(value => baselineReached(value, scaleType))
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
                  quantile: fenceQuantile,
                  zero: self.axisReachesZero,
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
         * The dendrogram, band strip and row labels at the display's left,
         * which the axis sits past on screen and the export parks left of the
         * figure; none while the rows are not drawn.
         */
        get sidebarPanel(): SvgSidebarProps | undefined {
          return self.drawsRows
            ? {
                showTree: self.showTree,
                hierarchy: self.hierarchy,
                sources: self.sources,
                rowHeight: self.effectiveRowHeight,
                treeAreaWidth: self.treeAreaWidth,
                showLabels: self.showRowLabels,
                bands: self.rowBands,
              }
            : undefined
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
         * The one y scale the chrome draws the axis from — `encoding.y` resolved:
         * its type, its domain autoscaled where it pins nothing, its title as
         * the caption and its rules. Every mark reads the same pair.
         */
        get valueScales(): ValueScale[] {
          const height = self.height
          const pointInset = this.valueInsetPx
          // One band per row where the marks stand in rows or a pinned
          // `rowHeight` sizes them, the scale ruling each on its own the way
          // the multi-wiggle display's does; the whole plot box otherwise.
          const { rowCount } = this
          const rowHeight = self.effectiveRowHeight
          const rowsTop = self.rowsTopOffset - self.scrollTop
          const band =
            rowCount > 1 || (self.drawsRows && self.rowHeight > 0)
              ? {
                  height: rowHeight,
                  offset: pointInset,
                  bandTops: Array.from(
                    { length: rowCount },
                    (_, row) => rowsTop + row * rowHeight,
                  ),
                }
              : self.rowFocusLineHeight
                ? {
                    height: height - self.rowFocusLineHeight,
                    offset: YSCALEBAR_LABEL_OFFSET + pointInset,
                    bandTops: [self.rowFocusLineHeight],
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
              left: self.sidebarPanel
                ? sidebarPanelWidth(self.sidebarPanel)
                : 0,
              caption: self.scaleTitle,
              rules: self.scoreRules,
              grid: self.grid,
            },
          ]
        },
        /**
         * #method
         * The plot as the worker reads it: each mark's encoding and lanes, and
         * the filters as transform steps. Every field and expression the plot
         * names is in it, and `adapterOptions` is not, so a display may
         * derive its options from what the plot reads.
         */
        plotRequest(): {
          layers: LayerRequest[]
          transform: TransformStep[]
          facet?: FacetSpec
        } {
          const field = self.splitField
          return withRootLane({
            layers: self.layerRequests,
            transform: [
              ...self.filterSteps,
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
          })
        },
        /**
         * #method
         * the fetch inputs SettingsInvalidate watches: `plotRequest`, all of
         * it evaluated in the worker, and the `adapterOptions` each region
         * resolves
         */
        rpcProps(): {
          layers: LayerRequest[]
          transform: TransformStep[]
          facet?: FacetSpec
          opts?: object
        } {
          const opts = self.adapterOptions
          return { ...(opts ? { opts } : {}), ...this.plotRequest() }
        },
        /**
         * #getter
         * bands a span stacks into: the facet's rows, one per row drawn under
         * `rows`, or else the highest `row` any loaded layer has, plus one
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
         * `RowHeightMixin`'s hook: the plot split between the rows. Rows under
         * `rows` fill the plot, a fraction of a px each where they must, as
         * every row display's do; a facet's packed rows keep whole px while
         * each can have one.
         */
        get autoRowHeight(): number {
          const { plotHeight } = this.plotBox
          return self.drawsRows
            ? plotHeight / Math.max(1, this.rowCount)
            : markRowHeightPx(plotHeight, this.rowCount)
        },
        /**
         * #getter
         * `TreeSidebarMixin`'s hook: the plot's top inset.
         */
        get rowsHeaderHeight(): number {
          return axisPlotBox(self.height).yTop
        },
        /**
         * #getter
         * The plot canvas's box: the axis inset, less the focus chip's line
         * at its top, so the canvas starts where the rows do.
         */
        get plotBox(): { yTop: number; plotHeight: number } {
          return {
            yTop: self.rowsTopOffset,
            plotHeight: Math.max(
              0,
              axisPlotBox(self.height).plotHeight - self.rowFocusLineHeight,
            ),
          }
        },
        /**
         * #getter
         * The color scale each mark paints through where its color is
         * quantitative: a ramp over the domain the legend already unioned
         * across the regions, its middle stop a value, or a threshold's cuts
         * and the packed color of each interval. Both ride uniforms, so a pan
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
         * Over the drawn layers, as the color ramp's domain is, so a hidden
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
                  // config, as a color ramp's domain does.
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
          const canvasHeight = this.plotBox.plotHeight
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
            colorsFromY: self.markColors.map(
              color => color.kind === 'numbers' && color.fromY,
            ),
            canvasWidth,
            canvasHeight,
            bpPerPx: self.host.bpPerPx,
            origin: self.origin,
            minWidthPx: MIN_MARK_WIDTH_PX,
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
         * invisible and every hue may be the color scale's; a shade over
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
          const top = self.rowsTopOffset
          const region = self.rpcDataMap.get(hit.regionIndex)
          const lit =
            hit.root !== undefined && region
              ? instancesOfFeature(region, hit.root)
              : [{ markIndex: hit.markIndex, index: hit.instance }]
          const instances = lit.flatMap(({ markIndex, index }) => {
            const mark = self.markList.findIndex(m => m.markIndex === markIndex)
            return mark === -1 ? [] : [{ mark, index }]
          })
          const boxes = inkOfInstances(
            self.markList,
            self.renderBlocks,
            index => self.rpcDataMap.get(index),
            this.renderState,
            index => (index === hit.regionIndex ? instances : undefined),
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
         * #method
         * The text marks' labels as records in the display's own px, for a
         * host that shows the plot canvas but not the text layer over it: a
         * ring of the circular view. Placed and culled as on screen.
         */
        floatingLabels(palette: JBrowsePalette): FloatingLabel[] {
          if (!self.markTypes.includes('text')) {
            return []
          }
          const fontSize = TEXT_MARK_FONT_PX
          const top = self.rowsTopOffset - fontSize * TEXT_BASELINE_RATIO
          return placeTextMarks(
            self.textMarkEntries,
            self.rpcDataMap,
            self.renderBlocks,
            this.renderState,
            { size: fontSize },
            palette.text.primary,
          ).map(label => ({
            key: `${label.regionIndex}-${label.markIndex}-${label.instance}`,
            x: label.x - label.width / 2,
            y: top + label.baseline,
            width: label.width,
            text: label.text,
            color: label.color,
            fontSize,
          }))
        },
        /**
         * #getter
         * The rule list over the live config, with each problem's level and
         * slot: jbrowse-img fails an export on an error and warns on the rest.
         */
        get configProblems(): MarkProblem[] {
          return markProblems({
            ...markPlotSettingsOf(self.conf),
            ...plotContextOf(self.conf),
          })
        },
        /**
         * #method
         * The rule list over a config, as lines. It replaces the schema's
         * rules rather than adding to them, since it checks the colors and
         * `encoding.y` itself.
         */
        configProblemsOf(conf: AnyConfigurationModel): string[] {
          return markProblems({
            ...markPlotSettingsOf(conf),
            ...plotContextOf(conf),
          }).map(problemText)
        },
        /**
         * #method
         * A draft as the rule list reads it, merged over `plot` and lifted by
         * the config schema, throwing what a config file would be refused
         * for. It changes no state on this display.
         */
        liftMarkPlot(plot: MarkPlot): MarkPlotSettings {
          return markPlotSettingsOf(self.liftPlot(plot, { whole: true }))
        },
        /**
         * #getter
         * What the adapter said about the loaded regions that the plot cannot
         * show — an index SNP no LD record names — each once, for the corner
         * notice, and each `filter` field no loaded feature carries.
         */
        get dataNotices(): string[] {
          const regions = [...self.rpcDataMap.values()]
          return [
            ...new Set(regions.flatMap(d => d.notices ?? [])),
            ...unreadInEveryRegion(regions.map(d => d.unreadFilterFields)).map(
              field => unreadFieldNotice(field, 'feature'),
            ),
          ]
        },
        /**
         * #getter
         * Overridable hook: notices a display derives from its state and
         * the view, beside the adapter's. Manhattan's reports when the LD index
         * SNP is out of reach of the screen.
         */
        get displayNotices(): string[] {
          return []
        },
        /**
         * #getter
         * A color over the rows' field whose written `range` names a color a
         * row's own replaces (`withRowColors`), one line per color object.
         */
        get rowColorNotices(): string[] {
          if (!self.drawsRows || !self.rowColorPaintsMarks) {
            return []
          }
          const rows = self.resolvedRowColors
          const lines = self.conf.marks.flatMap((m, i) => {
            const source = self.markColors[i]
            if (
              source?.kind !== 'categories' ||
              source.encoding.field !== self.rowsField
            ) {
              return []
            }
            const { domain = [], range = [] } = source.encoding
            const replaced = domain.map(String).filter((value, j) => {
              const row = rows.get(value)
              const own = range[j]
              return (
                row !== undefined &&
                own !== undefined &&
                cssColorToABGR(row) !== cssColorToABGR(own)
              )
            })
            const path = saysColor(m.encoding.color)
              ? `marks[${i}].encoding.color`
              : 'encoding.color'
            return replaced.length > 0
              ? [
                  `${path}.scale.range: ${replaced.join(', ')} paint their row colors; set those in rowColor`,
                ]
              : []
          })
          return [...new Set(lines)]
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
         * The config's lines, `dataNotices`, and the keys whose values
         * collide: what the corner's problems notice lists. The skipped count
         * appears in a separate chip.
         */
        get cornerNotices(): string[] {
          return [
            ...self.configNotices,
            ...this.dataNotices,
            ...this.displayNotices,
            ...this.rowColorNotices,
            ...this.sharedKeys.map(sharedKeyNotice),
          ]
        },
        /**
         * #getter
         * `dataNotices`, the colliding keys, and a mark whose every loaded
         * feature was skipped, which a mistyped field is: a display with any
         * of them still draws, so an agent's settle report lists them for a caller
         * that cannot see the corner.
         */
        get liveNotices(): string[] {
          const { skipped, total, fields } = this.skippedFeatures
          return [
            ...this.dataNotices,
            ...this.displayNotices,
            ...this.rowColorNotices,
            ...this.sharedKeys.map(sharedKeyNotice),
            ...(total > 0 && skipped === total
              ? [
                  `every one of ${total.toLocaleString()} ${pluralize(total, 'feature')} was skipped: ${fields.join(', ') || 'start or end'} missing or not a number`,
                ]
              : []),
          ]
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
            [...self.featurePayloads.values()].map(d =>
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
         * the color keys for the loaded regions, one per scale the marks
         * drawing at the view's zoom resolve through, each headed with its
         * channel's `title`
         */
        get legendSections() {
          const { visible } = self.markView
          const { marks } = self.conf
          return buildMarkLegend(
            self.scaleDataMap.values(),
            i => !!visible[i],
            (i, channel) =>
              keySettingOf(
                marks[i],
                channel,
                self.hiddenCategories,
                self.conf.encoding.color,
              ),
          )
        },
        /**
         * #getter
         * `LegendMixin`'s hook: the keys as color scales, so the chrome and the
         * export draw the legend off the tables the worker resolved, then the
         * row color key
         */
        get colorScales() {
          return [
            ...markColorScales(
              this.legendSections,
              self.facet
                ? categoricalField(self.facet.field, {
                    domain: self.facet.sort,
                  })
                : self.drawsRows
                  ? categoricalField(self.rowsField, {
                      domain: self.editableSources.map(row => row.name),
                    })
                  : undefined,
            ),
            ...self.rowColorScales,
          ]
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The px each row is drawn in, the band every shape gets:
         * `RowHeightMixin`'s under `rows`, pinned or fit. Elsewhere the bands
         * fit the plot whatever `rowHeight` holds, since a facet's rows and
         * have no scroll to reach past the plot's foot.
         */
        get effectiveRowHeight(): number {
          return resolveRowHeight(
            self.drawsRows ? self.rowHeight : 0,
            self.autoRowHeight,
          )
        },
        /**
         * #getter
         * `TrackHeightMixin`'s hook: the rows under `rows`, taller than the
         * plot wherever a pinned `rowHeight` asks for more than it holds.
         */
        get scrollContentHeight(): number {
          return self.drawsRows ? self.rowCount * self.effectiveRowHeight : 0
        },
        /**
         * #getter
         * `TrackHeightMixin`'s hook: the plot the rows scroll behind.
         */
        get scrollViewportHeight(): number {
          return self.plotBox.plotHeight
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Write every sized span's `mark.height.band`; a band-0 span stays
         * the line it draws.
         */
        setRowProportion(n: number) {
          for (const mark of self.conf.marks) {
            if (isSizedRect(mark)) {
              setConf(mark, ['mark', 'height', 'band'], n)
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
        /**
         * #action
         * Hide a key row's categories, or show them all again where any is
         * hidden: `field` the color's, `''` under an identity color.
         */
        toggleCategory(field: string, values: readonly string[]) {
          const hidden = self.hiddenCategories ?? []
          const named = (h: HiddenCategory) =>
            h.field === field && values.includes(h.value)
          const next = hidden.some(named)
            ? hidden.filter(h => !named(h))
            : [...hidden, ...values.map(value => ({ field, value }))]
          self.hiddenCategories = next.length > 0 ? next : undefined
        },
        /**
         * #action
         */
        showAllCategories() {
          self.hiddenCategories = undefined
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The mark clustering and "Sort rows by ... here" read at this zoom,
         * and what of its instances they compare (`rowCompareOf`).
         */
        get rowCompare(): RowCompare | undefined {
          return rowCompareOf(
            self.drawingMarkIndices,
            self.markTypes,
            self.markColors,
          )
        },
        /**
         * #getter
         * What a sort or a cluster caption names the compared thing.
         */
        get rowCompareLabel(): string {
          const compare = this.rowCompare
          return compare
            ? rowCompareLabel(compare.by, self.markColors[compare.mark])
            : 'value'
        },
        /**
         * #getter
         * The hidden categories a color drawn now reads, so a hide kept
         * across a field change counts only once its field is back.
         */
        get activeHiddenCategories(): readonly HiddenCategory[] {
          const fields = new Set(
            self.drawingMarkIndices.flatMap(i => {
              const color = self.markColors[i]
              return color?.kind === 'categories'
                ? [color.encoding.field]
                : color?.kind === 'identity'
                  ? ['']
                  : []
            }),
          )
          return (self.hiddenCategories ?? []).filter(h => fields.has(h.field))
        },
        /**
         * #getter
         * Two or more clusterable rows once the row listing settles, and a
         * mark to compare them on.
         */
        get autoClusterReady(): boolean {
          return (
            self.rowListingSettled &&
            self.clusterableSources.length > 1 &&
            this.rowCompare !== undefined
          )
        },
        /**
         * #getter
         */
        get svgSidebar(): SvgSidebarProps | undefined {
          const { sidebarPanel } = self
          return sidebarPanel
            ? { ...sidebarPanel, leftInset: leftAxisGutterWidth(self.axes) }
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
      .views(self => {
        const scanWindow = stableIdentityComputed(() =>
          plotScanRegions(self.host, onTrackAssembly(self)),
        )
        return {
          /**
           * #getter
           * The window a field scan reads now (`plotScanRegions`), the same
           * array while a pan stays inside its grid step
           */
          get plotScanWindow(): Region[] {
            return scanWindow.get()
          },
        }
      })
      .views(self => ({
        /**
         * #getter
         * The windows the held field scan read, for the dialog to name.
         */
        get plotScanLocus(): string | undefined {
          return self.plotScanned.length > 0
            ? self.plotScanned
                .map(({ refName, start, end }) =>
                  assembleLocString({ refName, start, end }),
                )
                .join(', ')
            : undefined
        },
      }))
      .actions(self => ({
        /**
         * #action
         * Open the feature widget on the read, the bin or the run a hit drew,
         * inside its facet section, through `selectEncodedFeature`.
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
         */
        setShowRowSeparators(show: boolean) {
          setConf(self, ['axis', 'grid'], show)
        },
        /**
         * #action
         * Write a default plot: its marks, its axis, a row per value of its
         * `rows` field where nothing splits the features yet, and its color
         * where the display states none.
         */
        applyDefaultPlot(plot: DefaultPlot) {
          setConf(self.conf, 'marks', plot.marks)
          if (plot.zero === false) {
            self.setScaleZero(false)
          }
          if (plot.rows && self.splitField === undefined) {
            setConf(self.conf, ['rows', 'field'], plot.rows)
          }
          if (plot.color && !saysColor(self.conf.encoding.color)) {
            setConf(self.conf, ['encoding', 'color'], plot.color)
          }
        },
        /**
         * #action
         * Order the rows by what `rowCompare` reads over (refName, pos), off
         * the loaded regions with no refetch: values and ramped numbers
         * highest first, a span's categories in blocks of one category, the
         * largest on screen first and then in the categories' order, and
         * covered rows before bare ones; false where no loaded region covers
         * the column.
         */
        sortRowsByValueAt(refName: string, pos: number) {
          const compare = self.rowCompare
          return sortRowsAtColumn(
            self,
            refName,
            pos,
            index => (compare ? self.rpcDataMap.get(index) : undefined),
            (rows, region) => {
              const { mark, by } = compare!
              const { rowTable } = self
              const { rowKeys } = self.rowKeySpace
              const byName = new Map<string, number>()
              for (const [key, value] of rowValuesAt(region, mark, pos, by)) {
                const name =
                  rowTable && keySlot(key, rowTable) !== undefined
                    ? rowKeys.names[key]
                    : undefined
                if (name !== undefined) {
                  byName.set(name, value)
                }
              }
              if (by !== 'colorKey') {
                return orderRowsByValueAt(rows, byName, (a, b) => b - a)
              }
              const category = categoriesByColor(region.layers[mark]?.scale)
              const categoryByName = new Map(
                [...byName].flatMap(([name, color]) => {
                  const value = category.get(color)
                  return value === undefined ? [] : [[name, value] as const]
                }),
              )
              return orderRowsByValueAt(
                rows,
                categoryByName,
                byCategoryBlocks(categoryByName),
              )
            },
          )
        },
        /**
         * #action
         * Write the `filter` list's expressions; undefined returns them to
         * what the track's config declares.
         */
        setFilter(filters?: string[]) {
          writeJexlFilters(self, filters ?? self.baseFilters())
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
          const regions = self.plotScanWindow
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
        openPlotDialog(seed?: MarkPlot, seedOptions?: PlotWriteOptions) {
          queuePlotDialog(self, seed, seedOptions)
        },
        /**
         * #action
         * Write every point mark's `encoding.size` number; undefined returns
         * each to the default.
         */
        setPointSize(val?: number) {
          for (const mark of self.conf.marks) {
            if (mark.mark.type === 'point') {
              setConf(mark, ['encoding', 'size', 'value'], val)
            }
          }
        },
        /**
         * #action
         * The ordinal analogue of the min/max dialog's "Use current
         * range": every value a colliding shape key lists goes into the
         * shape's `scale.domain`, in key order after what it already lists, so each
         * takes a separate shape.
         */
        pinDistinctShapes() {
          for (const key of self.sharedKeys) {
            for (const i of key.markIndexes) {
              setConf(
                self.conf.marks[i]!,
                ['encoding', 'shape', 'scale', 'domain'],
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
         * Fetch each needed region widened to the edges of the widest bin a
         * shared step or a mark drawing at this zoom cuts, so no bin a drawn
         * mark plots is cut at the fetch edge.
         */
        fetchNeeded(needed: IndexedRegion[]) {
          const { bpPerPx, displayedRegions } = self.host
          const { visible } = self.markView
          const { transform, facet, layers } = self.rpcProps()
          const step = widestBinStep([
            ...transform,
            ...(facet?.transform ?? []),
            ...layers.flatMap((layer, i) =>
              visible[i] ? (layer.transform ?? []) : [],
            ),
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
        /**
         * #action
         * Scan the current window, and write the default plot off it where the
         * window holds features and nothing has been declared meanwhile. A
         * failed scan is the error of a display with nothing to draw; a
         * declared plot draws on, and the next window scans again.
         */
        async decideDefaultPlot() {
          let fields: PlotFields
          try {
            fields = await self.ensurePlotFields()
          } catch (error) {
            if (isAlive(self) && self.plotFieldsError === error) {
              if (self.conf.marks.length === 0) {
                self.setError(error)
              } else {
                console.warn(`Could not scan the features' fields: ${error}`)
              }
            }
            return
          }
          if (
            !isAlive(self) ||
            fields.empty ||
            self.plotDefaultChecked ||
            self.conf.marks.length > 0
          ) {
            return
          }
          self.setPlotDefaultChecked()
          const plot = self.defaultPlotOf(fields)
          if (plot) {
            self.applyDefaultPlot(plot)
          } else {
            self.openMarkPlotDialog()
          }
        },
      }))
      .actions(self => ({
        afterAttach() {
          installPrerequisiteFetch(self, {
            name: 'MarkRowSources',
            delay: 0,
            report: { setStatusMessage: () => {} },
            gate: () => self.drawsRows,
            run: async (adapterConfig, ctx) =>
              (await ctx.callRpc('MarkGetRowSources', { adapterConfig })) ??
              null,
            commit: read => {
              self.setSourceListing(read)
            },
            setError: error => {
              if (error !== undefined) {
                console.warn(
                  `Could not list the adapter's sources; rows come from the features alone: ${error}`,
                )
                self.setSourceListing({
                  adapterConfig: self.adapterConfig,
                  value: null,
                })
              }
            },
          })
          setupTreeSidebarAutoruns(self, {
            name: 'Mark',
            sortRows: (refName, pos) => self.sortRowsByValueAt(refName, pos),
            clustering: {
              run: async args => {
                const { runMarkClustering } =
                  await import('./runMarkClustering.ts')
                await runMarkClustering({ model: self, ...args })
              },
            },
          })
          // Nothing declared draws nothing, and the Display types menu offers
          // this display on every feature, alignments and variant track. So
          // while `marks` is empty, the features decide (`defaultPlot`), or the
          // dialog opens where they decide nothing. A window with no features
          // decides nothing, and the next window scans again; a failed scan is
          // the display's error, and its retry scans again. A display whose
          // menus offer the fields scans the same way while it holds none.
          addDisposer(
            self,
            autorun(() => {
              const decides =
                !self.plotDefaultChecked && self.conf.marks.length === 0
              const holdsFields =
                self.plotFields !== undefined && !self.plotFields.empty
              if (
                !(decides || (self.menusOfferPlotFields && !holdsFields)) ||
                !self.host.initialized ||
                self.error !== undefined ||
                self.plotScanWindow.length === 0
              ) {
                return
              }
              void self.decideDefaultPlot()
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
export type { RowKeySpace, RowName } from './rowTable.ts'
export type { JoinedPlotFields, PlotFields } from './scanPlotFields.ts'
export type { StepChannels } from './stepChannels.ts'

export type LinearMarkDisplayStateModel = ReturnType<typeof stateModelFactory>
export interface LinearMarkDisplayModel extends Instance<LinearMarkDisplayStateModel> {}
