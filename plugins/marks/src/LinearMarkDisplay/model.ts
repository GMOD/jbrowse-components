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
  getDialogHost,
  getSession,
  openFeatureWidget,
  pluralize,
  withFeatureDetails,
} from '@jbrowse/core/util'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
import { aggregateFieldName } from '@jbrowse/core/util/featureTransforms'
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

import { binStepWidth } from './autoBin.ts'
import { markGlyphScale, markRequirementProblems } from './configSchema.ts'
import { densityRegionData } from './densityLayer.ts'
import { facetLayout, facetRegion } from './facet.ts'
import { fetchPlotFields, plotScanRegions } from './fetchPlotFields.ts'
import { sameMarkHit } from './findMarkHit.ts'
import { buildMarkLegend, colorSection, markColorScales } from './legend.ts'
import { buildMarkList, markDrawsAt, markRowHeightPx } from './markList.ts'
import { markProblems, problemText } from './markProblems.ts'
import { DEFAULT_BIN_AS, DEFAULT_PILEUP_FIELDS } from './markVocabulary.ts'
import {
  EMPTY_PLOT_SPEC,
  defaultPlotMarks,
  plotMarks,
  specOfMarks,
} from './plotFields.ts'
import { SHAPE_LANES } from './shapeLanes.ts'

import type { MarkDisplayContextMenuInfo } from './components/markDisplayTypes.ts'
import type {
  LinearMarkDisplayConfig,
  LinearMarkDisplayConfigModel,
  MarkConfig,
  MarkShapeName,
  MarkTransformStepConfig,
} from './configSchema.ts'
import type { FacetLayout } from './facet.ts'
import type { MarkHitInfo } from './findMarkHit.ts'
import type {
  MarkEntry,
  MarkRegionData,
  MarkRenderState,
  StoredLayer,
} from './markList.ts'
import type { MarkProblem, MarkSnapshot } from './markProblems.ts'
import type { PlotFields, PlotSpec } from './plotFields.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AggregateOp,
  EncodedFeaturesResult,
  FacetSpec,
  GlyphEncoding,
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

// The config's raw slot values as the worker's encoding: a `jexl:` string
// crosses untouched, which is why nothing here reads through `getConf`.
function encodingOf(mark: MarkConfig): MarkEncoding {
  const { x, x2, y, row, glyph, color } = mark.encoding
  const scaled = colorEncodingOf(color, 'categorical')
  const glyphEncoding: GlyphEncoding =
    markGlyphScale(glyph) === 'none'
      ? glyph.value
      : {
          field: glyph.field,
          scale: 'categorical',
          range: glyph.range.length > 0 ? [...glyph.range] : undefined,
          domain: glyph.domain.length > 0 ? [...glyph.domain] : undefined,
        }
  return {
    x,
    x2,
    // The field alone: the worker reads a value, and the scale it is read
    // through is the display's `scales.y`. Shipping that scale would put the
    // axis type and its bounds in the fetch's inputs, so a menu toggle
    // between linear and log would refetch every region to no effect.
    y: y === '' ? undefined : y,
    row: row || undefined,
    color: scaled,
    glyph: glyphEncoding,
  }
}

function pairOf(
  values: readonly string[],
  fallback: readonly [string, string],
): [string, string] {
  const [a, b] = values
  return values.length === 2 && a !== undefined && b !== undefined
    ? [a, b]
    : [...fallback]
}

// The field a position lane's number came from: the one a `bin` read where
// the bin wrote the lane's field, since the bin writes NaN edges for a feature
// lacking it, and the lane's own field where a later step made it anew.
function positionSource(
  steps: readonly MarkTransformStepConfig[],
  field: string,
): string {
  for (const step of steps.toReversed()) {
    if (
      step.type === 'bin' &&
      pairOf(step.as, DEFAULT_BIN_AS).includes(field)
    ) {
      return step.field
    }
    if (
      step.type === 'coverage' ||
      step.type === 'flatten' ||
      (step.type === 'formula' && step.as === field)
    ) {
      return field
    }
  }
  return field
}

// A step list as the worker's, every slot written out so a slot left at its
// default and one written at it are one fetch, and an `auto` bin resolved at
// `bpPerPx`.
function stepsOf(
  steps: readonly MarkTransformStepConfig[],
  bpPerPx: number,
): TransformStep[] {
  // The edges the last `bin` wrote, which an `aggregate` behind it groups by
  // when it names no fields of its own.
  let binEdges: [string, string] | undefined
  return steps.map((step): TransformStep => {
    switch (step.type) {
      case 'filter':
        return { type: 'filter', expr: step.expr }
      case 'formula':
        return { type: 'formula', expr: step.expr, as: step.as }
      case 'bin':
        binEdges = pairOf(step.as, DEFAULT_BIN_AS)
        return {
          type: 'bin',
          step: binStepWidth(step.step, bpPerPx),
          field: step.field,
          as: binEdges,
        }
      case 'aggregate':
        return {
          type: 'aggregate',
          groupby:
            step.groupby.length > 0 ? [...step.groupby] : (binEdges ?? []),
          ops: step.ops.map((o): AggregateOp => {
            const op = { op: o.op, field: o.field || undefined }
            return { ...op, as: o.as || aggregateFieldName(op) }
          }),
        }
      case 'coverage':
        return { type: 'coverage', as: step.as }
      case 'flatten':
        return {
          type: 'flatten',
          field: step.field,
          index: step.index,
          keepEmpty: step.keepEmpty,
        }
      case 'pileup':
        return {
          type: 'pileup',
          as: step.as,
          fields: pairOf(step.fields, DEFAULT_PILEUP_FIELDS),
          padding: step.padding,
        }
    }
  })
}

function widestBinStep(steps: readonly TransformStep[]) {
  let widest = 0
  for (const step of steps) {
    if (step.type === 'bin' && step.step > widest) {
      widest = step.step
    }
  }
  return widest
}

function toBinEdges(region: Region, step: number, bounds: Region) {
  return {
    ...region,
    start: Math.max(bounds.start, Math.floor(region.start / step) * step),
    end: Math.min(bounds.end, Math.ceil(region.end / step) * step),
  }
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
    shape: mark.shape,
    minBpPerPx: mark.minBpPerPx,
    maxBpPerPx: mark.maxBpPerPx,
    placed: mark.shape === 'span' || mark.encoding.y !== '',
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

// The `y` field every mark plotting a value names, or '' where they differ or
// name an expression, which is no title.
function sharedValueField(marks: readonly MarkConfig[]) {
  const fields = new Set(
    marks.flatMap(({ shape, encoding }) =>
      shape === 'span' || encoding.y === '' ? [] : [encoding.y],
    ),
  )
  const [field = ''] = fields
  return fields.size === 1 && !isJexl(field) ? field : ''
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
       * The declared marks' shapes, in draw order.
       */
      get markShapes(): MarkShapeName[] {
        return self.conf.marks.map(m => m.shape)
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
       * Each mark's shape and zoom range, what the mark list is built from.
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
        const visible: boolean[] = marks.map(m =>
          markDrawsAt(markEntryOf(m), bpPerPx),
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
       */
      get scatterPointSize(): number {
        return getConf(self, 'scatterPointSize')
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
       * The worker request, one layer per mark: its encoding and the lanes
       * its shape reads. Every mark is sent, the one outside its zoom range
       * included, so the worker encodes a layer the view will not draw:
       * measured at 280 ns a feature, 28 ms per 100,000, for the excluded
       * half of the default multiscale pair (`encodeFeatures.bench.ts`, the
       * pair table), against a parse in the hundreds of milliseconds. An
       * empty slot for it would make the zoom a fetch input and refetch the
       * pair on every crossing, so there is none (ADR-112).
       */
      get layerRequests(): LayerRequest[] {
        const { bpPerPx } = self.host
        return self.conf.marks.map((m): LayerRequest => {
          const shape: MarkShapeName = m.shape
          const transform = stepsOf(m.transform, bpPerPx)
          return {
            encoding: encodingOf(m),
            lanes: [...SHAPE_LANES[shape]],
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
       * The mark list the shapes declare — one `defineMark` per config entry,
       * reading `layers[i]`, off outside its zoom range. Recomputed only when
       * the entries move, so the component can key its backend factory on
       * it.
       */
      get markList() {
        return buildMarkList(self.markEntries)
      },
      /**
       * #getter
       * The shapes drawing at the view's zoom.
       */
      get visibleShapes(): MarkShapeName[] {
        const { visible } = self.markView
        return self.markShapes.filter((_, i) => visible[i])
      },
      /**
       * #getter
       */
      get hasPointMark(): boolean {
        return this.visibleShapes.includes('point')
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
       * The marks folded into the y domain: every one drawing at this zoom.
       */
      get valuedMarkIndices(): number[] {
        const { visible } = self.markView
        return self.markShapes.flatMap((_, i) => (visible[i] ? [i] : []))
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
        const indices = self.valuedMarkIndices
        const folded = new Set(indices)
        const shapes = indices.map(i => self.markShapes[i]!)
        const { origin, autoscaleType, numStdDev, numQuantile } = self
        const reached = [
          ...self.scoreRules.map(rule => rule.value),
          ...(shapes.includes('bar') ? [origin] : []),
        ]
        return visibleStatsDomain({
          active: shapes.some(s => s !== 'span'),
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
       * for the axis and every shape: glyph room where only points draw, and
       * none beside a bar, whose top edge is its datum and wants the plot box
       * itself.
       */
      get valueInsetPx(): number {
        const indices = self.valuedMarkIndices
        return indices.length > 0 &&
          indices.every(i => self.markShapes[i] === 'point')
          ? pointInsetPx(self.scatterPointSize)
          : 0
      },
      /**
       * #getter
       * What the axis is captioned with: `scales.y.title` where the config
       * wrote one, the empty string included, which is an axis left bare.
       * Unset, the `y` field the marks drawing a value at this zoom share, so
       * a multiscale pair reads `score` at one zoom and `count` at the other;
       * empty where they differ or name an expression, and while the density
       * sidecar stands in, whose bins are not the field's values.
       */
      get axisTitle(): string {
        const { marks } = self.conf
        return (
          self.scaleTitle ??
          (self.coarseTierStandsIn
            ? ''
            : sharedValueField(self.valuedMarkIndices.map(i => marks[i]!)))
        )
      },
      /**
       * #getter
       * The one y scale the chrome draws the axis from — `scales.y` resolved:
       * its type, its domain autoscaled where it pins nothing, its title as
       * the caption and its rules. Every mark's shapes read the same pair.
       */
      get valueScales(): ValueScale[] {
        const minimalTicks = getConf(self, 'minimalTicks')
        const height = self.height
        const glyphInset = this.valueInsetPx
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
                offset: glyphInset,
                bandTops: Array.from(
                  { length: rowCount },
                  (_, row) => yTop + row * rowHeight,
                ),
              }
            : {
                height,
                offset: YSCALEBAR_LABEL_OFFSET + glyphInset,
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
          ],
          ...(self.facet ? { facet: { field: self.facet.field } } : {}),
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
          pointDiameterPx: self.scatterPointSize,
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
        return [
          ...markRequirementProblems(marks),
          ...markProblems(marks, self.facet),
        ]
      },
      /**
       * #getter
       * The config problems as lines an agent's settle report carries: a
       * display with one still draws, so nothing else reaches a caller that
       * cannot see the corner notice.
       */
      get notices(): string[] {
        return this.configProblems.map(problemText)
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
          const steps = [...shared, ...m.transform]
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
       * drawing at the view's zoom resolve through
       */
      get legendSections() {
        const { visible } = self.markView
        return buildMarkLegend(self.rpcDataMap.values(), i => !!visible[i])
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
       * Stage a region as fetched, with this display's payload shape.
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
       * A field's own bands, in their sorted order. The whole object, so the
       * outgoing field's domain goes with it.
       */
      setFacetField(field: string) {
        setConf(self.conf, 'facet', field ? { field } : {})
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
      setPlotFieldsPromise(promise?: Promise<PlotFields>) {
        self.plotFieldsPromise = promise
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Scan the features for the fields a plot can read, once per display.
       */
      ensurePlotFields() {
        const pending = self.plotFieldsPromise ?? scanOnce()
        self.setPlotFieldsPromise(pending)
        return pending

        async function scanOnce() {
          const scan = self.plotScanRotation.begin()
          try {
            const fields = await fetchPlotFields({
              self,
              regions: plotScanRegions(self.host),
              opts: {
                signal: scan.signal,
                statusCallback: scan.statusCallback,
              },
            })
            self.setPlotFields(fields)
            return fields
          } catch (error) {
            self.setPlotFields(undefined, error)
            throw error
          } finally {
            scan.end()
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
       */
      setScatterPointSize(val?: number) {
        setConf(self, 'scatterPointSize', val)
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
          ...makePointSizeSubMenu(self, {
            label: 'Point size',
            applies: self.hasPointMark,
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
        const step = widestBinStep([
          ...self.rpcProps().transform,
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
