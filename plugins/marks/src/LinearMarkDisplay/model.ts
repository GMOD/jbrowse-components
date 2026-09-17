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
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import Flatbush from '@jbrowse/core/util/flatbush'
import { groupKeySpaceOf } from '@jbrowse/core/util/groupKeys'
import {
  activeJexlFilters,
  configuredJexlFilters,
  jexlFilterNarrowing,
} from '@jbrowse/core/util/jexlFilters'
import { DEFAULT_MARK_COLOR, valueField } from '@jbrowse/core/util/markEncoding'
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
import { coarseTierModeOf } from '@jbrowse/display-kit/densityTier'
import { densityTierMenuItems } from '@jbrowse/display-kit/densityTierMenu'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { sectionOrderMenuItems } from '@jbrowse/display-kit/groupByMenu'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/display-ui'
import { addDisposer, cast, types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances, pointInsetPx } from '@jbrowse/render-core/marks'
import {
  WiggleScoreConfigMixin,
  axisPlotBox,
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
import { densityRegionData } from './densityLayer.ts'
import {
  foldFacetSections,
  remapFacetRows,
  visibleFacetLayout,
} from './facet.ts'
import { fetchPlotFields, plotScanRegions } from './fetchPlotFields.ts'
import { sameMarkHit } from './findMarkHit.ts'
import { buildMarkLegend, colorSection, markColorScales } from './legend.ts'
import {
  SHAPE_LANES,
  buildMarkList,
  markDrawsAt,
  markRowHeightPx,
} from './markList.ts'
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
import type { PlotFields, PlotSpec } from './plotFields.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AggregateOp,
  ColorEncoding,
  EncodedFeaturesResult,
  FacetSection,
  FacetSpec,
  GlyphEncoding,
  GlyphName,
  LayerRequest,
  MarkEncoding,
  TransformStep,
} from '@jbrowse/core/util/markEncoding'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { CoarseTierMode } from '@jbrowse/display-kit/coarseTier'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { MarkRamp } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { ValueScale, VisibleEntry } from '@jbrowse/wiggle-core'

export type MarkRenderingBackend = PerRegionRenderingBackend<
  MarkRegionData,
  MarkRenderState
>

const JexlFilterDialog = lazy(() => import('@jbrowse/core/ui/JexlFilterDialog'))
const PlotFieldDialog = lazy(() => import('./components/PlotFieldDialog.tsx'))

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
    zoomRange: result.zoomRange,
  }
}

// The y field a skipped-feature notice names, whichever form the encoding
// declared it in.
function encodingY(encoding: MarkEncoding | undefined) {
  const y = encoding?.y
  return y === undefined ? undefined : valueField(y)
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

// A pinned end of a declared domain, or undefined where the author left it
// to autoscale.
function pinnedBound(raw: string | undefined) {
  const v = Number(raw)
  return raw === undefined || raw === '' || !Number.isFinite(v) ? undefined : v
}

/** The `[min, max]` a mark's `y` declaration pins, either end open. */
export function declaredDomain(
  mark: MarkConfig,
): [number | undefined, number | undefined] {
  const d = mark.encoding.y.domain
  return [pinnedBound(d[0]), pinnedBound(d[1])]
}

// The config's raw slot values as the worker's encoding: a `jexl:` string
// crosses untouched, which is why nothing here reads through `getConf`.
interface MarkFacetConfig {
  field: string
  domain: readonly string[]
}

function facetConfigOf(marks: MarkConfig[]): MarkFacetConfig | undefined {
  return marks.find(m => m.facet.field !== '')?.facet
}

function facetSpecOf(facet: MarkFacetConfig): FacetSpec {
  const domain = [...facet.domain]
  return { field: facet.field, ...(domain.length ? { domain } : {}) }
}

function encodingOf(mark: MarkConfig): MarkEncoding {
  const { x, x2, y, row, glyph, color } = mark.encoding
  const scaled: ColorEncoding =
    color.scale === 'none'
      ? color.value
      : color.scale === 'categorical'
        ? {
            field: color.field,
            scale: 'categorical',
            palette: color.palette.length > 0 ? [...color.palette] : undefined,
            domain: color.domain.length > 0 ? [...color.domain] : undefined,
          }
        : {
            field: color.field,
            scale: color.scale,
            domain:
              color.domain.length === 2
                ? [Number(color.domain[0]), Number(color.domain[1])]
                : undefined,
            ramp:
              color.ramp.length === 0
                ? undefined
                : color.ramp.length === 1 && color.ramp[0] === 'viridis'
                  ? 'viridis'
                  : [...color.ramp],
          }
  const glyphEncoding: GlyphEncoding =
    glyph.scale === 'none'
      ? (glyph.value as GlyphEncoding)
      : {
          field: glyph.field,
          scale: 'categorical',
          range:
            glyph.range.length > 0
              ? ([...glyph.range] as GlyphName[])
              : undefined,
          domain: glyph.domain.length > 0 ? [...glyph.domain] : undefined,
        }
  return {
    x,
    x2,
    // The field alone: the worker reads a value, and the scale it is read
    // through is the display's. Shipping the declared scale would put the
    // axis type and its bounds in the fetch's inputs, so a menu toggle
    // between linear and log would refetch every region to no effect.
    y: y.field === '' ? undefined : y.field,
    row: row === '' ? undefined : row,
    color: scaled,
    glyph: glyphEncoding,
  }
}

// The config's step list as the worker's, with the empty slot values that
// mean "default" left off the wire and an `auto` bin resolved at `bpPerPx`.
function transformOf(mark: MarkConfig, bpPerPx: number): TransformStep[] {
  return mark.transform.map((step: MarkTransformStepConfig): TransformStep => {
    const as: string[] = [...step.as]
    switch (step.type) {
      case 'filter': {
        return { type: 'filter', expr: step.expr }
      }
      case 'formula': {
        return { type: 'formula', expr: step.expr, as: as[0] ?? 'value' }
      }
      case 'bin': {
        return {
          type: 'bin',
          step: binStepWidth(step.step, bpPerPx),
          field: step.field || undefined,
          as: as.length === 2 ? [as[0]!, as[1]!] : undefined,
        }
      }
      case 'aggregate': {
        return {
          type: 'aggregate',
          groupby: [...step.groupby],
          ops: step.ops.map(
            (o: Instance<typeof step.ops>[number]): AggregateOp => ({
              op: o.op,
              field: o.field || undefined,
              as: o.as || undefined,
            }),
          ),
        }
      }
      case 'coverage': {
        return { type: 'coverage', as: as[0] }
      }
      case 'flatten': {
        return { type: 'flatten', field: step.field || undefined, index: as[0] }
      }
      case 'stack': {
        const fields = [...step.fields]
        return {
          type: 'stack',
          as: as[0],
          fields: fields.length === 2 ? [fields[0]!, fields[1]!] : undefined,
          padding: step.padding || undefined,
          groupby: step.groupby.length > 0 ? [...step.groupby] : undefined,
        }
      }
      default: {
        throw new Error(`unknown transform step ${String(step.type)}`)
      }
    }
  })
}

// A mark's colour where it declares a constant one, packed as the worker
// would have packed it. A scale has no meaning over a bin the sidecar wrote,
// and a jexl callback has no feature to read.
function markConstantColor(mark: MarkConfig): number {
  const { scale, value } = mark.encoding.color
  return cssColorToABGR(
    scale === 'none' && !value.startsWith('jexl:') ? value : DEFAULT_MARK_COLOR,
  )
}

function markEntryOf(mark: MarkConfig): MarkEntry {
  return {
    shape: mark.shape,
    minBpPerPx: mark.minBpPerPx,
    maxBpPerPx: mark.maxBpPerPx,
  }
}

/** The marks at the view's zoom: which draw, and which own each role. */
export interface MarkView {
  visible: boolean[]
  valueMark: number
  independentMark: number
  densityMark: number
}

// Which axis a mark's value reads, or none for a mark with no `y` field.
function yRoleOf(mark: MarkConfig): 'shared' | 'independent' | 'none' {
  const { field, resolve } = mark.encoding.y
  return field === '' ? 'none' : resolve
}

function layerExtremes(entries: VisibleEntry<StoredLayer>[]) {
  let min = Infinity
  let max = -Infinity
  for (const { data } of entries) {
    min = Math.min(min, data.yMin)
    max = Math.max(max, data.yMax)
  }
  return Number.isFinite(min) ? { min, max } : undefined
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
      WiggleScoreConfigMixin(),
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
        return specOfMarks(self.conf.marks) ?? EMPTY_PLOT_SPEC
      },
      /**
       * #getter
       * The declared marks' shapes, in draw order.
       */
      get markShapes(): MarkShapeName[] {
        return self.conf.marks.map((m: MarkConfig) => m.shape)
      },
      /**
       * #getter
       * The facet field: the categorical field whose values each take their
       * own band of rows, off the first mark declaring one, or `''`.
       */
      get facetField(): string {
        return facetConfigOf(self.conf.marks)?.field ?? ''
      },
      /**
       * #getter
       * The facet's declared section order, off the same mark as the field.
       */
      get facetDomain(): string[] {
        return [...(facetConfigOf(self.conf.marks)?.domain ?? [])]
      },
      /**
       * #getter
       * `HiddenGroupsMixin`'s hook: a section key means nothing outside the
       * facet that issued it, so moving the field drops what was hidden.
       */
      get groupKeySpace(): string {
        return groupKeySpaceOf(
          this.facetField
            ? { type: 'facet', field: this.facetField }
            : undefined,
        )
      },
      /**
       * #getter
       * Each mark's shape and zoom range, what the mark list is built from.
       */
      get markEntries(): MarkEntry[] {
        return self.conf.marks.map((m: MarkConfig) => markEntryOf(m))
      },
      /**
       * #getter
       * The marks at the view's zoom: whether each draws, inside its
       * `minBpPerPx`..`maxBpPerPx` range where 0 is no bound, and the first
       * drawing mark owning each role, -1 where none does. The shared value
       * scale is one declaration and the menu edits it; the config schema
       * refuses a second independent axis; the density sidecar stands in for
       * one mark.
       */
      get markView(): MarkView {
        const { bpPerPx } = self.host
        const { marks } = self.conf
        const visible: boolean[] = marks.map((m: MarkConfig) =>
          markDrawsAt(markEntryOf(m), bpPerPx),
        )
        const firstDrawing = (owns: (m: MarkConfig) => boolean) =>
          marks.findIndex((m: MarkConfig, i: number) => visible[i] && owns(m))
        return {
          visible,
          valueMark: firstDrawing(m => yRoleOf(m) === 'shared'),
          independentMark: firstDrawing(m => yRoleOf(m) === 'independent'),
          densityMark: firstDrawing(m => m.source === 'density'),
        }
      },
      /**
       * #getter
       * The mark reading its own axis, or -1.
       */
      get independentMarkIndex(): number {
        return this.markView.independentMark
      },
      /**
       * #getter
       * The mark owning the display's shared value scale, or -1.
       */
      get valueMarkIndex(): number {
        return this.markView.valueMark
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
       * `ScoreScaleMixin`'s hook: the scale type and the pinned bounds come
       * off the owning mark's `encoding.y`, so the axis, the ticks and the
       * shapes read one declaration.
       */
      get declaredValueScale() {
        const mark = self.conf.marks[this.valueMarkIndex]
        return mark
          ? { scaleType: mark.encoding.y.scale, domain: declaredDomain(mark) }
          : undefined
      },
      /**
       * #getter
       * The declared marks' encodings, as the worker takes them.
       */
      get encodings(): MarkEncoding[] {
        return self.conf.marks.map((m: MarkConfig) => encodingOf(m))
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
        return self.conf.marks.map((m: MarkConfig) => {
          const shape: MarkShapeName = m.shape
          const transform = transformOf(m, bpPerPx)
          return {
            encoding: encodingOf(m),
            lanes: [...SHAPE_LANES[shape]],
            ...(transform.length > 0 ? { transform } : {}),
            ...(m.facet.field ? { facet: facetSpecOf(m.facet) } : {}),
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
    .views(self => ({
      /**
       * #getter
       * The facet's sections over every loaded region, in key order.
       */
      get facetSections(): FacetSection[] {
        return self.facetField
          ? foldFacetSections(self.featurePayloads, self.facetDomain)
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Where each visible section sits: the hidden ones gone and the rest
       * re-cumulated, which is the row space every region is offset onto.
       */
      get facetLayout(): FacetLayout {
        return visibleFacetLayout(self.facetSections, self.hiddenGroupKeys)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The layers the display draws: faceted, every region's rows offset
       * onto the one layout, so a chip and the band under it agree whichever
       * region a span came from.
       */
      get rpcDataMap(): ReadonlyMap<number, MarkRegionData> {
        return self.facetSections.length > 0
          ? remapFacetRows(self.featurePayloads, self.facetLayout)
          : self.featurePayloads
      },
    }))
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
      get hasBarMark(): boolean {
        return this.visibleShapes.includes('bar')
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
       * The marks folded into the shared y domain: those drawing at this
       * zoom, less the one reading its own axis.
       */
      get sharedMarkIndices(): number[] {
        const { visible } = self.markView
        const { independentMarkIndex } = self
        return self.markShapes.flatMap((_, i) =>
          visible[i] && i !== independentMarkIndex ? [i] : [],
        )
      },
      /**
       * #method
       * The nice-rounded [min, max] the marks in `indices` fold to over the
       * visible regions' shipped extremes, widened to the origin where one
       * of them is a bar, or undefined before any of them loads a value.
       */
      markDomain(
        indices: readonly number[],
        bounds: readonly [number | undefined, number | undefined],
        scaleType: string,
      ) {
        const origin = self.origin
        const folded = new Set(indices)
        const shapes = indices.map(i => self.markShapes[i]!)
        const hasBar = shapes.includes('bar')
        return visibleStatsDomain({
          active: shapes.some(s => s !== 'span'),
          view: self.host,
          payloadFor: index => self.rpcDataMap.get(index),
          itemsFor: data =>
            data.layers.filter(
              (l, i) => folded.has(i) && l.count > 0 && Number.isFinite(l.yMin),
            ),
          accumulate: layerExtremes,
          range: ({ min, max }) =>
            hasBar ? widenRangeToRules([min, max], [origin]) : [min, max],
          bounds,
          scaleType,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * nice-rounded [min, max] over the visible regions' shipped extremes,
       * widened to the origin whenever a bar mark draws, or undefined before
       * any shared valued mark loads
       */
      get domain() {
        return self.markDomain(
          self.sharedMarkIndices,
          [self.minScoreBound, self.maxScoreBound],
          self.scaleType,
        )
      },
      /**
       * #getter
       * The independent mark's own scale, folded from its layers alone and
       * pinned by its own `encoding.y.domain`: what the right-hand axis and
       * that mark's shapes read.
       */
      get independentValueScale():
        | { domain: [number, number]; scaleType: string; field: string }
        | undefined {
        const i = self.independentMarkIndex
        const mark = self.conf.marks[i]
        if (!mark) {
          return undefined
        }
        const scaleType = mark.encoding.y.scale
        const domain = self.markDomain([i], declaredDomain(mark), scaleType)
        return domain
          ? { domain, scaleType, field: mark.encoding.y.field }
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The y scale the chrome draws the axis from — the declared
       * `encoding.y`, resolved: its type, and its domain autoscaled where it
       * pins nothing. The shapes read the same pair.
       */
      get valueScales(): ValueScale[] {
        const minimalTicks: boolean = getConf(self, 'minimalTicks')
        const height = self.height
        const second = self.independentValueScale
        const sharedField =
          self.conf.marks[self.valueMarkIndex]?.encoding.y.field
        // A point stands at its centre and needs glyph room at both ends; a
        // bar's top edge is its datum and wants the plot box itself.
        const glyphInset = (indices: readonly number[]) =>
          indices.length > 0 &&
          indices.every(i => self.markShapes[i] === 'point')
            ? pointInsetPx(self.scatterPointSize)
            : 0
        // One band per row where the marks stand in rows, the scale ruling
        // each on its own the way the multi-wiggle display's does; the whole
        // plot box otherwise.
        const rowCount = this.rowCount
        const { yTop, plotHeight } = axisPlotBox(height)
        const rowHeight = markRowHeightPx(plotHeight, rowCount)
        const band = (indices: readonly number[]) =>
          rowCount > 1
            ? {
                height: rowHeight,
                offset: glyphInset(indices),
                bandTops: Array.from(
                  { length: rowCount },
                  (_, row) => yTop + row * rowHeight,
                ),
              }
            : {
                height,
                offset: YSCALEBAR_LABEL_OFFSET + glyphInset(indices),
              }
        return [
          {
            domain: self.domain,
            scaleType: self.scaleType,
            ...band(self.sharedMarkIndices),
            minimalTicks,
            // Captioned only where a second axis is drawn: with one axis
            // there is nothing to tell it apart from.
            caption: second ? sharedField : undefined,
          },
          ...(second
            ? [
                {
                  domain: second.domain,
                  scaleType: second.scaleType,
                  ...band([self.independentMarkIndex]),
                  minimalTicks,
                  side: 'right' as const,
                  caption: second.field,
                },
              ]
            : []),
        ]
      },
      /**
       * #method
       * the fetch inputs SettingsInvalidate watches: each mark's encoding
       * and lanes, and the filters as transform steps, all evaluated in the
       * worker
       */
      rpcProps(): { layers: LayerRequest[]; transform: TransformStep[] } {
        return {
          layers: self.layerRequests,
          transform: self.activeFilters.map(expr => ({
            type: 'filter' as const,
            expr,
          })),
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
        return self.conf.marks.map((_: MarkConfig, i: number) => {
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
        const markIndex = self.independentMarkIndex
        const second = self.independentValueScale
        const independentY =
          markIndex === -1
            ? undefined
            : resolveRenderState(second?.domain, domain => ({
                markIndex,
                domain,
                scaleType:
                  second?.scaleType === 'log'
                    ? ('log' as const)
                    : ('linear' as const),
              }))
        return resolveRenderState(self.domain, domainY => ({
          domainY,
          scaleTypeY,
          independentY,
          colorRamps,
          canvasWidth,
          canvasHeight,
          bpPerPx: self.host.bpPerPx,
          origin: self.origin,
          minWidthPx: self.minWidthPx,
          pointDiameterPx: self.scatterPointSize,
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
       * `y` field read as missing or not a number — for the corner notice.
       */
      get skippedFeatures(): SkippedFeatures {
        const { encodings } = self
        const { visible } = self.markView
        return skippedFeatures(
          [...self.rpcDataMap.values()].map(d =>
            d.layers
              .map((layer, i) => ({
                count: layer.count,
                skipped: layer.skipped,
                field: encodingY(encodings[i]),
              }))
              .filter((_, i) => visible[i]),
          ),
        )
      },
      /**
       * #getter
       * the colour keys the loaded regions carry, one per scaled mark
       * drawing at the view's zoom
       */
      get legendSections() {
        const { visible } = self.markView
        return buildMarkLegend(self.rpcDataMap.values()).filter(
          s => visible[s.markIndex],
        )
      },
      /**
       * #getter
       * `LegendMixin`'s hook: the keys as color scales, so the chrome and the
       * export draw the legend off the tables the worker resolved
       */
      get colorScales() {
        return markColorScales(this.legendSections)
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
       * Open the feature widget for a hit: the worker shipped channels, not
       * records, so the features are read back over the hit's span and the
       * mark's steps run again over them, which remakes a bin or a run. It
       * sends the view's zoom as the fetch did, so a BigWig answers with the
       * tier rows the hit was drawn from rather than raw records no tier row
       * matches.
       */
      selectFeature(hit: MarkHitInfo) {
        const region: Region | undefined =
          self.host.displayedRegions[hit.regionIndex]
        // Past the budget the read-back is the download the gate refused, so
        // a bin of the sidecar opens nothing.
        if (!region || self.coarseTierStandsIn) {
          return
        }
        const steps = [
          ...self.rpcProps().transform,
          ...(self.layerRequests[hit.markIndex]?.transform ?? []),
        ]
        const fetch = self.detailsRotation.begin()
        void withFeatureDetails(
          self,
          async () => {
            try {
              const features = await getSession(self).rpcManager.call(
                getRpcSessionId(self),
                'CoreGetFeatures',
                {
                  adapterConfig: self.adapterConfig,
                  regions: [
                    {
                      ...region,
                      start: hit.start,
                      end: Math.max(hit.end, hit.start + 1),
                    },
                  ],
                  opts: { bpPerPx: self.host.bpPerPx },
                  signal: fetch.signal,
                  statusCallback: fetch.statusCallback,
                },
              )
              if (!fetch.isCurrent()) {
                return undefined
              }
              const made = runTransforms(features, steps, pluginManager.jexl)
              return (
                made.find(
                  f => f.get('start') === hit.start && f.get('end') === hit.end,
                ) ??
                made.find(
                  f => f.get('start') <= hit.start && f.get('end') >= hit.end,
                )
              )
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
       * The Sections menu's reorder lands on the declaration: the mark that
       * names the facet owns its domain, so the drawn order writes there.
       */
      setFacetDomain(domain: string[]) {
        const mark = self.conf.marks.find(
          (m: MarkConfig) => m.facet.field !== '',
        )
        if (mark) {
          setConf({ configuration: mark.facet }, 'domain', domain)
        }
      },
      /**
       * #action
       * The score menu's pin lands on the declaration: `encoding.y` owns the
       * value scale, so an edited bound writes there and not on a second
       * pair of display slots. `end` is 0 for the minimum, 1 for the
       * maximum; `undefined` reopens that end to autoscale.
       */
      setDeclaredBound(end: 0 | 1, val?: number) {
        const mark = self.conf.marks[self.valueMarkIndex]
        if (!mark) {
          setConf(self, end === 0 ? 'minScore' : 'maxScore', val)
          return
        }
        const y = mark.encoding.y
        const next = [y.domain[0] ?? '', y.domain[1] ?? '']
        next[end] = val === undefined ? '' : String(val)
        setConf(
          { configuration: y },
          'domain',
          next[0] === '' && next[1] === '' ? [] : next,
        )
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
       */
      setMinScore(val?: number) {
        self.setDeclaredBound(0, val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        self.setDeclaredBound(1, val)
      },
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
        self.conf.setSubschemaArray(
          'marks',
          plotMarks(spec, self.plotFields ?? { numeric: [], categorical: [] }),
        )
      },
      /**
       * #action
       * Writes the owning mark's declared scale type, the same declaration
       * the axis and the shapes read.
       */
      setScaleType(scaleType: string) {
        const mark = self.conf.marks[self.valueMarkIndex]
        if (mark) {
          setConf({ configuration: mark.encoding.y }, 'scale', scaleType)
        } else {
          setConf(self, 'scaleType', scaleType)
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
          // The shared radio offers symlog, which the declared enum does not
          // admit; the scale type is config-only until it does.
          makeScoreSubMenu(self, {
            scaleType: false,
            autoscale: false,
            domain: self.domain,
          }),
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
          ...sectionOrderMenuItems(
            {
              sections: self.facetLayout.sections,
              domain: self.facetDomain,
              setDomain: domain => {
                self.setFacetDomain(domain)
              },
              hideGroup: key => {
                self.hideGroup(key)
              },
            },
            'section',
          ),
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
        const { bpPerPx } = self.host
        return fetchEachRegion(self, needed, {
          call: (region, ctx) =>
            ctx.callRpc('CoreEncodeFeatures', {
              ...rpcArgs(self),
              bpPerPx,
              region,
            }),
          onResult: (_idx, result) => storedRegionData(result),
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
