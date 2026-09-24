import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { filterMenuItems } from '@jbrowse/core/ui/filterMenuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import {
  assembleLocString,
  getDialogHost,
  getSession,
  openFeatureWidget,
  pluralize,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import Flatbush from '@jbrowse/core/util/flatbush'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'
import {
  activeJexlFilters,
  configuredJexlFilters,
  jexlFilterNarrowing,
} from '@jbrowse/core/util/jexlFilters'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import DensityTierMixin from '@jbrowse/display-kit/DensityTierMixin'
import HiddenGroupsMixin from '@jbrowse/display-kit/HiddenGroupsMixin'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { coarseTierModeOf } from '@jbrowse/display-kit/densityTier'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import { facetSettingOf } from '@jbrowse/display-kit/facetConfigSchema'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { sectionOrderMenuItems } from '@jbrowse/display-kit/groupByMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/display-ui'
import { addDisposer, cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { createEncodeMemo } from '@jbrowse/render-core/encodeMemo'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances, pointInsetPx } from '@jbrowse/render-core/marks'
import {
  ScoreScaleMixin,
  autoscaleDomainFromSpans,
  axisPlotBox,
  computeSpanStats,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
  visibleStatsDomain,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import { makePointSizeSubMenu } from '@jbrowse/wiggle-core/chrome'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import { autorun } from 'mobx'

import {
  DEFAULT_POINT_DIAMETER_PX,
  markRequirementProblems,
} from './configSchema.ts'
import { densityRegionData } from './densityLayer.ts'
import { facetLayout, facetRegion } from './facet.ts'
import { fetchPlotFields, plotScanRegions } from './fetchPlotFields.ts'
import { sameMarkHit } from './findMarkHit.ts'
import { buildMarkLegend, colorSection, markColorScales } from './legend.ts'
import {
  buildMarkList,
  markDrawsAt,
  markRowHeightPx,
  zoomInRange,
} from './markList.ts'
import { markProblems, problemText } from './markProblems.ts'
import {
  encodingOf,
  lastBinEdges,
  positionSource,
  stepsOf,
  toBinEdges,
  widestBinStep,
} from './markRequest.ts'
import { markLanes, readsValue } from './markSpecs.ts'
import {
  EMPTY_PLOT_SPEC,
  defaultPlotMarks,
  plotMarks,
  specOfMarks,
} from './plotFields.ts'

import type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
import type {
  LinearMarkDisplayConfig,
  LinearMarkDisplayConfigModel,
  MarkConfig,
  MarkType,
} from './configSchema.ts'
import type { FacetLayout } from './facet.ts'
import type { MarkHitInfo } from './findMarkHit.ts'
import type {
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from './markList.ts'
import type {
  FacetSnapshot,
  MarkProblem,
  MarkSnapshot,
  StepSnapshot,
} from './markProblems.ts'
import type { PlotFields, PlotSpec } from './plotFields.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  EncodedFeaturesResult,
  FacetSpec,
  LayerRequest,
  MarkEncoding,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { CoarseTierMode } from '@jbrowse/display-kit/coarseTier'
import type { FacetSetting } from '@jbrowse/display-kit/facetConfigSchema'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { MarkRamp } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { ScoreSpan, ValueScale, VisibleEntry } from '@jbrowse/wiggle-core'

export type MarkRenderingBackend = PerRegionRenderingBackend<
  MarkRegionData,
  MarkRenderState
>

const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))
const PlotFieldDialog = lazy(() => import('./components/PlotFieldDialog.tsx'))

const NO_REGIONS: ReadonlyMap<number, MarkRegionData> = new Map()

// The worker's layers as the display stores them: the Flatbush wrapped once
// at the commit.
function storedRegionData(result: EncodedFeaturesResult): MarkRegionData {
  return {
    layers: result.layers.map((layer): StoredLayer => ({
      ...layer,
      flatbush: layer.flatbushData
        ? Flatbush.from(layer.flatbushData)
        : undefined,
    })),
    facet: result.facet,
    zoomRange: result.zoomRange,
  }
}

function highestRow(layers: readonly StoredLayer[], visible: boolean[]) {
  let highest = 0
  for (const [mark, { row }] of layers.entries()) {
    if (row && visible[mark]) {
      for (let i = 0; i < row.length; i++) {
        if (row[i]! > highest) {
          highest = row[i]!
        }
      }
    }
  }
  return highest
}

// A mark's colour where it declares a constant one, packed as the worker
// would have packed it. A scale has no meaning over a bin the sidecar wrote,
// and a jexl callback has no feature to read.
function markConstantColor(mark: MarkConfig): number {
  const encoding = colorEncodingOf(mark.encoding.color, 'categorical')
  return cssColorToABGR(
    typeof encoding === 'string' && !isJexl(encoding)
      ? encoding
      : DEFAULT_MARK_COLOR,
  )
}

function markEntryOf(mark: MarkConfig): MarkEntry {
  return {
    type: mark.mark,
    minBpPerPx: mark.minBpPerPx,
    maxBpPerPx: mark.maxBpPerPx,
    placed: !readsValue(mark.mark) || mark.encoding.y !== '',
  }
}

/** The marks at the view's zoom: which draw, and which the sidecar stands in for. */
export interface MarkView {
  visible: boolean[]
  densityMark: number
}

// Each folded layer as a `ScoreSpan`, so the shared autoscale walks the `y`
// lane the same way it walks a wiggle source's scores: one value per instance,
// clipped to the block the entry carries.
function layerSpans(entries: VisibleEntry<StoredLayer>[]): ScoreSpan[] {
  return entries.flatMap(({ data, visStart, visEnd }) => {
    const { y } = data
    return y
      ? [
          {
            count: data.count,
            starts: data.x,
            ends: data.x2,
            stride: 1,
            endOffset: 0,
            low: y,
            high: y,
            avg: y,
            visStart,
            visEnd,
          },
        ]
      : []
  })
}

/**
 * #stateModel LinearMarkDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * A display declared in config: a list of bar, point and span marks, each
 * with an encoding from feature fields to channels, drawn in order over one
 * score axis from one worker fetch per region.
 */
export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: LinearMarkDisplayConfigModel,
) {
  return types
    .compose(
      'LinearMarkDisplay',
      // Nested so the parts stay under `types.compose`'s nine, the ceiling
      // whose tenth part erases every prop instead of failing.
      types.compose(BaseDisplay, TrackHeightMixin(), MultiRegionDisplayMixin()),
      // Where the byte gate refuses the features, a mark declaring
      // `source: 'density'` draws the adapter's sidecar in the banner's place
      // — see `densityPayloads`.
      DensityTierMixin(),
      ScoreScaleMixin(),
      LegendMixin(),
      ContextMenuMixin<MarkDisplayContextMenuInfo>(),
      StoredHoverMixin<MarkHitInfo>(sameMarkHit),
      HiddenGroupsMixin(),
      types.model({
        type: types.literal('LinearMarkDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * The "Filter by..." dialog's override of the `jexlFilters` slot,
         * `jexl:`-prefixed; unset follows the config.
         */
        jexlFiltersSetting: types.maybe(types.array(types.string)),
      }),
    )
    .views(() => ({
      /**
       * #getter
       * Opt into the byte gate: `CoreEncodeFeatures` measures the index before
       * it downloads, so an over-budget region is refused before a feature is
       * read, and the density tier draws in place of the refused region.
       */
      get gateEnabled() {
        return true
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the config typed off the concrete schema
       */
      get conf(): LinearMarkDisplayConfig {
        return self.configuration
      },
    }))
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
       * The spec the dialog opens on: the declared marks read back where they
       * are a plot the dialog could have written, else an empty one.
       */
      get plotSpec(): PlotSpec {
        return this.declaredPlotSpec ?? EMPTY_PLOT_SPEC
      },
      /**
       * #getter
       * The declared marks as a spec, where writing that spec back is the
       * marks declared.
       */
      get declaredPlotSpec(): PlotSpec | undefined {
        return specOfMarks(getSnapshot(self.conf.marks), marks =>
          getSnapshot(
            configSchema.create({
              type: 'LinearMarkDisplay',
              displayId: 'plotSpec',
              marks,
            }).marks,
          ),
        )
      },
      /**
       * #getter
       * How many declared marks the dialog cannot read back — a span, a third
       * mark, a transform on the plot itself — and would therefore replace
       * rather than edit. 0 where a save is the round trip it looks like.
       */
      get plotSpecReplaces(): number {
        return this.declaredPlotSpec ? 0 : self.conf.marks.length
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
        return self.conf.marks.map(m => markEntryOf(m))
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
            (m, i) => visible[i] && m.source === 'density',
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
       * The configured cross-hatch setting the menu toggles; `showCrossHatches`
       * is what draws, and on this display the two are one — nothing here
       * spends colour on the score instead of height.
       */
      get displayCrossHatches(): boolean {
        return getConf(self, 'displayCrossHatches')
      },
      /**
       * #getter
       */
      get showCrossHatches(): boolean {
        return this.displayCrossHatches
      },
      /**
       * #getter
       * Each mark's `size`: a point's diameter in px, which a bar or
       * span leaves unread.
       */
      get markSizes(): number[] {
        return self.conf.marks.map(m => m.size)
      },
      /**
       * #getter
       * The size the Point size menu shows: the first point mark's, or the
       * default where no mark is a point.
       */
      get pointSize(): number {
        const first = self.conf.marks.find(m => m.mark === 'point')
        return first ? first.size : DEFAULT_POINT_DIAMETER_PX
      },
      /**
       * #getter
       * The declared marks' encodings, as the worker takes them.
       */
      get encodings(): MarkEncoding[] {
        return self.conf.marks.map(m => encodingOf(m))
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
        const { encodings } = this
        return self.conf.marks.map((m, i): LayerRequest => {
          const transform = stepsOf(
            m.transform,
            zoomInRange(m, bpPerPx),
            binEdges,
          )
          return {
            encoding: encodings[i]!,
            lanes: markLanes(m.mark),
            ...(transform.length > 0 ? { transform } : {}),
          }
        })
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
       * the `jexlFilters` slot, `jexl:`-prefixed
       */
      get configuredFilters() {
        return () => configuredJexlFilters(self)
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
    }))
    .views(self => ({
      /**
       * #getter
       */
      get coarseTierStandsIn(): boolean {
        return self.coarseTierActive && self.host.initialized
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
              densityRegionData(bins, self.conf.marks.length, markIndex, color),
            )
          }
        }
        return payloads
      },
    }))
    .views(self => ({
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
          ? self.densityPayloads
          : (self.regionPayloads as ReadonlyMap<number, MarkRegionData>)
      },
    }))
    .views(self => {
      const layout = stableIdentityComputed(() => {
        const { field = '', domain = [] } = self.facet ?? {}
        return facetLayout(
          self.featurePayloads.values(),
          categoricalField(field, { domain }),
          self.hiddenGroupKeys,
        )
      })
      const faceted = createEncodeMemo(
        () => (self.facet ? self.featurePayloads : NO_REGIONS),
        () => layout.get(),
        facetRegion,
      )
      return {
        /**
         * #getter
         * The sections drawn over every loaded region, in the domain's order
         * and less the hidden ones, and where each key's rows start.
         */
        get facetLayout(): FacetLayout {
          return layout.get()
        },
        /**
         * #getter
         * The layers the display draws: faceted, every region's rows offset
         * onto the one layout, so a chip and the band under it agree
         * whichever region a span came from. A region is offset again only
         * when it or the layout moves, which is what the upload re-packs.
         */
        get rpcDataMap(): ReadonlyMap<number, MarkRegionData> {
          const drawn = faceted()
          return self.facet ? drawn : self.featurePayloads
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * The mark list the marks declare — one `defineMark` per config entry,
       * reading `layers[i]`, off outside its zoom range. Recomputed only when
       * the entries move, so the component can key its backend factory on
       * it.
       */
      get markList() {
        return buildMarkList(self.markEntries)
      },
      /**
       * #getter
       * The mark types drawing at the view's zoom.
       */
      get visibleMarkTypes(): MarkType[] {
        const { visible } = self.markView
        return self.markTypes.filter((_, i) => visible[i])
      },
      /**
       * #getter
       */
      get hasPointMark(): boolean {
        return this.visibleMarkTypes.includes('point')
      },
      /**
       * #getter
       * the filters actually applied, `jexl:`-prefixed
       */
      get activeFilters(): string[] {
        return activeJexlFilters(self)
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
       * nice-rounded [min, max] over the `y` of every mark drawing at this
       * zoom, through the autoscale mode `scales.y` names, widened to every
       * rule the scale declares and to the origin whenever a bar mark draws,
       * or undefined before any valued mark loads
       */
      get domain() {
        const indices = self.drawingMarkIndices
        const folded = new Set(indices)
        const types = indices.map(i => self.markTypes[i]!)
        const { origin, autoscaleType, numStdDev, numQuantile } = self
        const reached = [
          ...self.scoreRules.map(rule => rule.value),
          ...(types.includes('bar') ? [origin] : []),
        ]
        return visibleStatsDomain({
          active: types.some(readsValue),
          view: self.host,
          payloadFor: index => self.rpcDataMap.get(index),
          itemsFor: data =>
            data.layers.filter(
              (l, i) => folded.has(i) && l.count > 0 && Number.isFinite(l.yMin),
            ),
          accumulate: entries => computeSpanStats(layerSpans(entries)),
          range: (stats, entries) =>
            widenRangeToRules(
              autoscaleDomainFromSpans({
                stats,
                autoscaleType,
                numStdDev,
                numQuantile,
                spans: layerSpans(entries),
              }),
              reached,
            ),
          bounds: [self.minScoreBound, self.maxScoreBound],
          scaleType: self.scaleType,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The px the y scale stands in from both ends of its band, one number
       * for the axis and every mark: point room where only points draw, and
       * none beside a bar, whose top edge is its datum and wants the plot box
       * itself.
       */
      get valueInsetPx(): number {
        const indices = self.drawingMarkIndices
        return indices.length > 0 &&
          indices.every(i => self.markTypes[i] === 'point')
          ? pointInsetPx(Math.max(...indices.map(i => self.markSizes[i]!)))
          : 0
      },
      /**
       * #getter
       * What the axis is captioned with: `scales.y.title` where the config
       * wrote one, and nothing otherwise, as a caption is optional
       */
      get axisTitle(): string {
        return self.scaleTitle ?? ''
      },
      /**
       * #getter
       * The one y scale the chrome draws the axis from — `scales.y` resolved:
       * its type, its domain autoscaled where it pins nothing, its title as
       * the caption and its rules. Every mark reads the same pair.
       */
      get valueScales(): ValueScale[] {
        const minimalTicks = getConf(self, 'minimalTicks')
        const height = self.height
        const pointInset = this.valueInsetPx
        // One band per row where the marks stand in rows, the scale ruling
        // each on its own the way the multi-wiggle display's does; the whole
        // plot box otherwise.
        const rowCount = this.rowCount
        const { yTop, plotHeight } = axisPlotBox(height)
        const rowHeight = markRowHeightPx(plotHeight, rowCount)
        const band =
          rowCount > 1
            ? {
                height: rowHeight,
                offset: pointInset,
                bandTops: Array.from(
                  { length: rowCount },
                  (_, row) => yTop + row * rowHeight,
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
            ...band,
            minimalTicks,
            caption: this.axisTitle,
            rules: self.scoreRules,
          },
        ]
      },
      /**
       * #method
       * the fetch inputs SettingsInvalidate watches: each mark's encoding
       * and lanes, and the filters as transform steps, all evaluated in the
       * worker
       */
      rpcProps(): {
        layers: LayerRequest[]
        transform: TransformStep[]
        facet?: FacetSpec
      } {
        return {
          layers: self.layerRequests,
          transform: [
            ...self.activeFilters.map(expr => ({
              type: 'filter' as const,
              expr,
            })),
            ...stepsOf(self.conf.transform, self.host.bpPerPx),
            ...(self.facet ? [] : self.facetSteps),
          ],
          ...(self.facet
            ? {
                facet: {
                  field: self.facet.field,
                  ...(self.facetSteps.length > 0
                    ? { transform: self.facetSteps }
                    : {}),
                },
              }
            : {}),
        }
      },
      /**
       * #getter
       * bands a span stacks into: the highest `row` any loaded layer
       * carries, plus one
       */
      get rowCount(): number {
        if (self.facetLayout.rowCount > 0) {
          return self.facetLayout.rowCount
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
       * Each mark's quantitative colour scale: the ramp its regions carry,
       * over the domain the legend already unioned across them. A pan that
       * widens it writes one uniform and uploads no instance bytes, which is
       * what resolving the ramp here rather than per region buys.
       */
      get colorRamps(): (MarkRamp | undefined)[] {
        const sections = this.legendSections
        return self.conf.marks.map((_, i) => {
          const table = colorSection(sections, i)
          return table?.kind === 'ramp'
            ? { domain: table.domain, scale: table.scale, lut: table.lut }
            : undefined
        })
      },
      /**
       * #getter
       * geometry and scale for the plot canvas, the same box the hit test
       * measures in
       */
      get renderState(): MarkRenderState {
        const canvasWidth = self.canvasWidthPx
        const canvasHeight = axisPlotBox(self.height).plotHeight
        const scaleTypeY = self.scaleType === 'log' ? 'log' : 'linear'
        const { colorRamps } = this
        return resolveRenderState(self.domain, domainY => ({
          domainY,
          scaleTypeY,
          colorRamps,
          canvasWidth,
          canvasHeight,
          bpPerPx: self.host.bpPerPx,
          origin: self.origin,
          minWidthPx: self.minWidthPx,
          markSizes: self.markSizes,
          valueInsetPx: this.valueInsetPx,
          rowCount: this.rowCount,
        }))
      },
      /**
       * #getter
       * The box the hovered instance painted, for the chrome's highlight; the
       * context menu's hit stands in while a menu is open. In the chrome's px,
       * so the plot's inset is added to the canvas box.
       */
      get hoverInk(): HighlightRect[] {
        const hit = self.hoveredFeature ?? self.contextMenuInfo?.hit
        if (!hit) {
          return []
        }
        const top = axisPlotBox(self.height).yTop
        return inkOfInstances(
          self.markList,
          self.renderBlocks,
          index => self.rpcDataMap.get(index),
          this.renderState,
          index =>
            index === hit.regionIndex
              ? [{ mark: hit.markIndex, index: hit.instance }]
              : undefined,
        ).map(r => ({ ...r, top: r.top + top }))
      },
      /**
       * #getter
       * What the declared marks say that the display cannot draw as written,
       * reported where a load would once have refused the track.
       */
      get configProblems(): MarkProblem[] {
        const marks: MarkSnapshot[] = getSnapshot(self.conf.marks)
        const transform = getSnapshot(self.conf.transform) as StepSnapshot[]
        return [
          ...markRequirementProblems(marks),
          ...markProblems(
            marks,
            getSnapshot(self.conf.facet) as FacetSnapshot,
            transform,
          ),
        ]
      },
      /**
       * #getter
       * The config problems as lines, for the corner notice.
       */
      get configNotices(): string[] {
        return this.configProblems.map(problemText)
      },
      /**
       * #getter
       * Rows the plot has no pixel for: a row is never drawn shorter than
       * one, and the plot does not scroll.
       */
      get rowsBelowPlot(): number {
        const { plotHeight } = axisPlotBox(self.height)
        const rows = this.rowCount
        const rowHeight = markRowHeightPx(plotHeight, rows)
        return Math.max(0, rows - Math.floor(plotHeight / rowHeight))
      },
      /**
       * #getter
       */
      get rowsCutNotice(): string | undefined {
        const cut = this.rowsBelowPlot
        const rows = this.rowCount
        return cut > 0
          ? `${cut.toLocaleString()} of ${rows.toLocaleString()} rows fall below the plot and are not drawn; a taller track shows them`
          : undefined
      },
      /**
       * #getter
       * What the display drew around, as lines an agent's settle report
       * carries: its config problems, and the rows it had no room for.
       */
      get notices(): string[] {
        const { rowsCutNotice } = this
        return [
          ...this.configNotices,
          ...(rowsCutNotice ? [rowsCutNotice] : []),
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
        const shared = self.conf.transform
        const positionFields = self.conf.marks.map((m, i) => {
          const steps = [
            ...shared,
            ...self.conf.facet.transform,
            ...m.transform,
          ]
          const { x = 'start', x2 = 'end' } = encodings[i] ?? {}
          return [
            ...new Set([positionSource(steps, x), positionSource(steps, x2)]),
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
       * colour's `title`
       */
      get legendSections() {
        const { visible } = self.markView
        const { marks } = self.conf
        return buildMarkLegend(
          self.rpcDataMap.values(),
          i => !!visible[i],
          i => marks[i]?.encoding.color.title,
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
            ? categoricalField(self.facet.field, { domain: self.facet.domain })
            : undefined,
        )
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
       * Open the feature widget for a hit. The worker shipped channels, not
       * records, so it is asked again with the request the hit's region was
       * fetched under and answers the feature the instance's `featureIndex`
       * names: the read, the bin or the run as drawn, inside its facet section.
       * A bin of the density sidecar opens nothing, its region holding no
       * request — the read-back is the download the gate refused.
       */
      selectFeature(hit: MarkHitInfo) {
        const request = self.featurePayloads.get(hit.regionIndex)?.request
        if (!request) {
          return
        }
        const fetch = self.detailsRotation.begin()
        void withFeatureDetails(
          self,
          async () => {
            try {
              const feature = await getSession(self).rpcManager.call(
                getRpcSessionId(self),
                'CoreGetEncodedFeature',
                {
                  ...request,
                  layer: hit.markIndex,
                  featureIndex: hit.featureIndex,
                  signal: fetch.signal,
                  statusCallback: fetch.statusCallback,
                },
              )
              return feature && fetch.isCurrent()
                ? new SimpleFeature(feature)
                : undefined
            } finally {
              fetch.end()
            }
          },
          feature => {
            openFeatureWidget(self, feature.toJSON(), { feature })
          },
        )
      },
      /**
       * #action
       * Stage a region as fetched, with this display's payload layout.
       */
      setRpcData(idx: number, data: EncodedFeaturesResult, region: Region) {
        self.setLoadedRegion(idx, region, storedRegionData(data))
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
        setConf(self.conf, ['facet', 'field'], field)
        setConf(self.conf, ['facet', 'domain'], [])
      },
      /**
       * #action
       */
      setJexlFilters(filters?: string[]) {
        self.jexlFiltersSetting = cast(filters)
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
       * answers only for the window it read, and a failed one for nothing.
       */
      ensurePlotFields() {
        const regions = plotScanRegions(self.host)
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

        async function scan() {
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
       * What the dialog writes: the plot's mark, and the binned count beside
       * it where the user asked for one.
       */
      setPlotMarks(spec: PlotSpec) {
        const fields = self.plotFields ?? { numeric: [], categorical: [] }
        self.conf.setSubschemaArray('marks', plotMarks(spec, fields))
        if (fields.facet) {
          self.setFacetField(fields.facet)
        }
      },
      /**
       * #action
       */
      toggleCrossHatches() {
        setConf(self, 'displayCrossHatches', !self.displayCrossHatches)
      },
      /**
       * #action
       * Write every point mark's `size`; undefined returns each to the
       * default.
       */
      setPointSize(val?: number) {
        for (const mark of self.conf.marks) {
          if (mark.mark === 'point') {
            setConf(mark, 'size', val)
          }
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Open the dialog, prefilled from a single-mark config where the display
       * already carries one, with the field scan running behind it.
       */
      openPlotFieldDialog() {
        void self.ensurePlotFields().catch(() => {})
        getDialogHost(self).queueDialog(handleClose => [
          PlotFieldDialog,
          { model: self, handleClose },
        ])
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return [
          {
            label: 'Plot field...',
            icon: ShowChartIcon,
            onClick: () => {
              self.openPlotFieldDialog()
            },
          },
          makeScoreSubMenu(self, { domain: self.domain }),
          ...makePointSizeSubMenu({
            label: 'Point size',
            applies: self.hasPointMark,
            value: () => self.pointSize,
            defaultValue: DEFAULT_POINT_DIAMETER_PX,
            set: n => {
              self.setPointSize(n)
            },
          }),
          ...filterMenuItems({
            narrowings: { jexlFilters: jexlFilterNarrowing(self) },
            onEdit: () => {
              getDialogHost(self).queueDialog(handleClose => [
                JexlFilterDialog,
                { model: self, handleClose },
              ])
            },
          }),
          ...sectionOrderMenuItems({
            sections: self.facetLayout.sections,
            domain: self.facet?.domain ?? [],
            setDomain: domain => {
              self.setFacetDomain(domain)
            },
            hideGroup: key => {
              self.hideGroup(key)
            },
          }),
          ...densityTierMenuItems(self),
          ...makeShowSubMenu([
            makeCrossHatchItem(self),
            legendCheckboxItem(self),
          ]),
        ]
      },
      /**
       * #method
       */
      contextMenuItems(): MenuItem[] {
        const hit = self.coarseTierStandsIn
          ? undefined
          : self.contextMenuInfo?.hit
        return hit
          ? [
              {
                label: 'Open feature details',
                icon: MenuOpenIcon,
                onClick: () => {
                  self.selectFeature(hit)
                },
              },
            ]
          : []
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
          ...self.layerRequests.flatMap(l => l.transform ?? []),
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
        const { byteLimit, ...request } = { ...rpcArgs(self), bpPerPx }
        return fetchEachRegion(self, regions, {
          call: (region, ctx) =>
            ctx.callRpc('CoreEncodeFeatures', {
              ...request,
              byteLimit,
              region,
            }),
          onResult: (_idx, result, region) => ({
            ...storedRegionData(result),
            request: { ...request, region },
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
        // Nothing declared draws nothing, and the Display types menu offers
        // this display on every feature, alignments and variant track. So the
        // first time it is shown with an empty `marks`, the features decide:
        // bars of a numeric `score`, or the dialog where they carry none.
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
            const fields = await self.ensurePlotFields().catch(() => undefined)
            if (!fields || self.conf.marks.length > 0) {
              return
            }
            const marks = defaultPlotMarks(fields)
            if (marks) {
              self.conf.setSubschemaArray('marks', marks)
              if (fields.facet) {
                self.setFacetField(fields.facet)
              }
            } else {
              self.openPlotFieldDialog()
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
}

export type LinearMarkDisplayStateModel = ReturnType<typeof stateModelFactory>
export interface LinearMarkDisplayModel extends Instance<LinearMarkDisplayStateModel> {}
