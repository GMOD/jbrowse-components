import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost, openFeatureWidget, toLocale } from '@jbrowse/core/util'
import { categoricalField } from '@jbrowse/core/util/categoricalField'
import Flatbush from '@jbrowse/core/util/flatbush'
import {
  MAX_LEGEND_ENTRIES,
  derivedColorScale,
} from '@jbrowse/core/util/legendCandidates'
import {
  numericDomain,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin, {
  legendCheckboxItem,
} from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import { skippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { types } from '@jbrowse/mobx-state-tree'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { inkOfInstances } from '@jbrowse/render-core/marks'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import {
  ScoreFieldConfigMixin,
  axisPlotBox,
  makeCrossHatchItem,
  makeScoreSubMenu,
  resolveRenderState,
  visibleStatsDomain,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import { makePointSizeSubMenu } from '@jbrowse/wiggle-core/chrome'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'

import { LD_FIELD } from './colorConfigSchema.ts'
import {
  LD_LEGEND_TITLE,
  isLdColoring,
  ldColorDefaults,
  ldLegend,
} from './ldBins.ts'
import { MANHATTAN_MARKS } from './manhattanMarks.ts'

import type {
  ManhattanColor,
  ManhattanColorScale,
  ManhattanRpcResult,
} from '../ManhattanRPC/rpcTypes.ts'
import type {
  ManhattanContextMenuInfo,
  ManhattanDisplayModel,
} from './components/manhattanDisplayTypes.ts'
import type {
  LinearManhattanDisplayConfig,
  LinearManhattanDisplayConfigModel,
} from './configSchemaFactory.ts'
import type { ManhattanHit } from './findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
} from './manhattanRenderingBackendTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Region } from '@jbrowse/core/util/types/data'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type {
  HighlightRect,
  HighlightStyle,
} from '@jbrowse/display-kit/highlightHost'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ValueScale, VisibleEntry } from '@jbrowse/wiggle-core'

// The Manhattan walker: the worker ships each region's score extremes already
// reduced, so the domain is their min/max rather than a scan of the scores.
// The Flatbush the hit test needs, wrapped once at the commit and carried in
// the stored payload. It was a second per-region map beside the data, and
// keeping the two in step was what `clearDisplaySpecificData` had to clear
// together.
type StoredManhattanData = ManhattanRpcResult & { flatbush?: Flatbush }

function storedManhattanData(data: ManhattanRpcResult): StoredManhattanData {
  return {
    ...data,
    flatbush: data.flatbushData ? Flatbush.from(data.flatbushData) : undefined,
  }
}

function shippedExtremes(entries: VisibleEntry<ManhattanRpcResult>[]) {
  let scoreMin = Infinity
  let scoreMax = -Infinity
  for (const { data } of entries) {
    if (data.yMin < scoreMin) {
      scoreMin = data.yMin
    }
    if (data.yMax > scoreMax) {
      scoreMax = data.yMax
    }
  }
  return Number.isFinite(scoreMin) ? { scoreMin, scoreMax } : undefined
}

const SetSignificanceLineDialog = lazy(
  () => import('./components/SetSignificanceLineDialog.tsx'),
)
const SetColorFieldDialog = lazy(
  () => import('./components/SetColorFieldDialog.tsx'),
)

// The LD key's rows, and — where nothing matched the index SNP — a note saying
// so, or an export where every point is grey sits under a full r² key that
// implies the colors mean something.
function ldScale(
  color: { domain: readonly string[]; palette: readonly string[] },
  indexSnpMissing: boolean,
): ColorScale {
  return {
    kind: 'categorical',
    id: 'ld',
    title: LD_LEGEND_TITLE,
    entries: [
      ...ldLegend(color).map(({ label, color }) => ({
        value: label,
        label,
        color,
      })),
      ...(indexSnpMissing
        ? [{ value: 'missing', label: 'Index SNP not in LD data: all grey' }]
        : []),
    ],
  }
}

// Red, where a configured wiggle rule defaults to grey: this one is a
// significance threshold rather than a reference level the reader chose, and it
// is the only rule this display draws.
const SIGNIFICANCE_LINE_COLOR = 'rgb(200,60,60)'

/**
 * #stateModel LinearManhattanDisplay
 * #displayFoundation MultiRegionDisplayMixin
 * GWAS Manhattan-plot display drawing -log10 p-values as a scored scatter along
 * the genome, with a feature widget on click.
 */
export function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: LinearManhattanDisplayConfigModel,
) {
  return (
    types
      .compose(
        'LinearManhattanDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        ScoreFieldConfigMixin(),
        LegendMixin(),
        ContextMenuMixin<ManhattanContextMenuInfo>(),
        StoredHoverMixin<ManhattanHit>(),
        types.model({
          type: types.literal('LinearManhattanDisplay'),
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based)
           * string. Auto-tracks the highest-scoring loaded SNP unless the user
           * pins one (see `indexSnpPinned`).
           */
          indexSnp: types.maybe(types.string),
          /**
           * #property
           * True once the user pins a specific index SNP (right-clicking a point).
           * While false, the index auto-tracks the top hit as data loads.
           */
          indexSnpPinned: types.stripDefault(types.boolean, false),
        }),
      )
      .views(self => ({
        /**
         * #getter
         * The fetched points, keyed by displayedRegionIndex — the foundation's
         * per-region store, narrowed. The Flatbush rides in the payload rather
         * than in a second map kept in lockstep with it, so a single-region
         * fetch still wraps only that region.
         */
        get rpcDataMap(): ReadonlyMap<number, StoredManhattanData> {
          return self.regionPayloads as ReadonlyMap<number, StoredManhattanData>
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The per-region hit-test indexes, as the map `findManhattanHit` takes.
         */
        get flatbushes(): ReadonlyMap<number, Flatbush> {
          return new Map(
            [...self.rpcDataMap].flatMap(([idx, d]) =>
              d.flatbush ? [[idx, d.flatbush] as const] : [],
            ),
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * the config typed off the concrete schema; `ConfigurationReference`
         * erases `self.configuration` to `any`, so reads route through this to
         * stay typed
         */
        get conf(): LinearManhattanDisplayConfig {
          return self.configuration
        },
      }))
      .views(self => ({
        /**
         * #getter
         * Offset the track label above the plot so the -log10(p) y-axis stays
         * pinned to the content edge instead of dodging right of the label.
         */
        get prefersOffset() {
          return true
        },
        /**
         * #getter
         * The `color` object, forwarded to the worker whole, its `scale` the
         * one that paints. `value` is read raw rather than through `getConf`,
         * which would evaluate a `jexl:` callback against no feature and
         * throw; the worker binds `feature` and evaluates it per point
         * (`colorSlotTransport.test.ts`).
         */
        get color(): ManhattanColor {
          const field = getConf(self, ['color', 'field'])
          const scale = paintedScale(
            { scale: getConf(self, ['color', 'scale']), field },
            field === LD_FIELD ? 'threshold' : 'categorical',
          )
          const written = {
            domain: getConf(self, ['color', 'domain']),
            palette: getConf(self, ['color', 'palette']),
          }
          return {
            value: self.conf.color.value,
            field,
            scale,
            ...(isLdColoring({ field, scale })
              ? ldColorDefaults(written)
              : written),
          }
        },
        /**
         * #getter
         * the PLINK .ld sub-adapter configured on the track's `GWASAdapter`, or
         * undefined when none is set (the slot defaults to null, normalized here
         * to undefined for "absent")
         */
        get ldAdapterConfig(): Record<string, unknown> | undefined {
          // array slot path off the LIVE parent track, not a read against
          // `self.adapterConfig` — that is itself a snapshot, and
          // `types.stripDefault` omits a slot at its default, so a slot read
          // against a snapshot can report a defaulted slot as absent
          return (
            getConf(self.parentTrack, ['adapter', 'ldAdapter']) ?? undefined
          )
        },
        /**
         * #getter
         * LD coloring needs a configured .ld adapter; without one the LD
         * controls are inert, so they're hidden/disabled
         */
        get hasLdData(): boolean {
          return this.ldAdapterConfig !== undefined
        },
        /**
         * #getter
         * LD coloring is actually in effect — the scale is `ld` *and* there's
         * an .ld adapter for it to read. The scale alone can be `ld` from config
         * with no adapter configured, in which case the worker paints
         * `color.value`, so every LD affordance (legend, missing-index warning)
         * keys off this getter.
         */
        get ldColoringActive(): boolean {
          return isLdColoring(this.color) && this.hasLdData
        },
        /**
         * #getter
         * the configured threshold score, or undefined when the slot is unset
         */
        get significanceLine(): number | undefined {
          return getConf(self, 'significanceLine')
        },
        /**
         * #getter
         * nice-rounded [min, max] -log10 p domain across the visible regions,
         * or undefined before any data loads. The only walker of the four that
         * reads shipped per-region extremes rather than scanning scores: the
         * worker already reduced them, so a block contributes its whole
         * region's extremes rather than the part it shows.
         *
         * Widened to reach the significance line, the same way the wiggle
         * displays widen theirs to reach a configured `scoreRules` entry. The
         * threshold answers "does anything here clear it?", so the window where
         * the answer is no — every score well under the line — is the one where
         * an unwidened axis drops the line and leaves the reader nothing to
         * read the plot against. `widenRangeToRules` applies to the raw range,
         * so an explicit `scales.y` bound still wins.
         */
        get domain() {
          const line = this.significanceLine
          return visibleStatsDomain({
            active: true,
            view: self.host,
            payloadFor: index => self.rpcDataMap.get(index),
            itemsFor: data => (data.count === 0 ? [] : [data]),
            accumulate: shippedExtremes,
            range: ({ scoreMin, scoreMax }) =>
              widenRangeToRules(
                [scoreMin, scoreMax],
                line === undefined ? [] : [line],
              ),
            bounds: [self.minScoreBound, self.maxScoreBound],
            scaleType: self.scaleType,
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * The y scale the chrome draws the axis from. Manhattan plots are
         * linear-only — `scales.y.type` admits nothing else, since the points
         * are pre-transformed -log10 p values. The threshold is the scale's
         * one rule, which the chrome and the export both draw off the axis.
         */
        get valueScales(): ValueScale[] {
          const line = self.significanceLine
          return [
            {
              domain: self.domain,
              scaleType: self.scaleType,
              height: self.height,
              minimalTicks: getConf(self, 'minimalTicks'),
              rules:
                line === undefined
                  ? []
                  : [{ value: line, color: SIGNIFICANCE_LINE_COLOR }],
            },
          ]
        },
        /**
         * #method
         * fetch inputs watched by SettingsInvalidate — any change (score field,
         * color, index SNP, LD adapter) triggers a refetch, since the worker
         * reads the field and bakes per-feature color into the result
         */
        rpcProps(): {
          scoreField: string
          color: ManhattanColor
          indexSnp: string | undefined
          ldAdapterConfig: Record<string, unknown> | undefined
        } {
          return {
            scoreField: self.scoreField,
            color: self.color,
            indexSnp: self.indexSnp,
            ldAdapterConfig: self.ldAdapterConfig,
          }
        },
        /**
         * #getter
         * render geometry for the inner canvas (between top/bottom YScaleBar label
         * offsets) — the area both the GPU renderer and findManhattanHit work in.
         * Using self.height directly would drift the hit-test off the rendered
         * points.
         */
        get renderState(): ManhattanRenderState {
          const canvasWidth = self.canvasWidthPx
          const canvasHeight = axisPlotBox(self.height).plotHeight
          return resolveRenderState(self.domain, domainY => ({
            domainY,
            canvasWidth,
            canvasHeight,
            pointDiameterPx: self.scatterPointSize,
          }))
        },
        /**
         * #getter
         * A ring around the hovered point, for the chrome's highlight: the
         * glyph's box grown to the ring's radius, which sits a fixed margin
         * outside the point and floors at 6 px so a tiny point stays findable.
         * A ring rather than a shade because a wash over a 4 px glyph is
         * invisible, and every hue is taken by the colour schemes.
         */
        get hoverInk(): HighlightRect[] {
          const hit = self.hoveredFeature
          if (!hit) {
            return []
          }
          const plotTop = axisPlotBox(self.height).yTop
          const r = Math.max(6, self.scatterPointSize / 2 + 4)
          return inkOfInstances(
            MANHATTAN_MARKS,
            self.renderBlocks,
            index => self.rpcDataMap.get(index),
            this.renderState,
            index =>
              index === hit.regionIndex
                ? [{ mark: 0, index: hit.instance }]
                : undefined,
          ).map(box => ({
            left: box.left + box.width / 2 - r,
            top: plotTop + box.top + box.height / 2 - r,
            width: 2 * r,
            height: 2 * r,
          }))
        },
        /**
         * #getter
         */
        get highlightStyle(): HighlightStyle {
          return 'ring'
        },
        /**
         * #getter
         * What the worker left out of the loaded regions — a feature whose
         * `scoreField` read as missing or not a number — for the corner
         * notice.
         */
        get skippedFeatures(): SkippedFeatures {
          const field = self.scoreField
          return skippedFeatures(
            [...self.rpcDataMap.values()].map(d => [
              { count: d.count, skipped: d.skipped, field },
            ]),
          )
        },
      }))
      .views(self => ({
        /**
         * #getter
         * highest-scoring loaded SNP as a `chr:bp` (1-based) string — the default
         * LD index SNP. Derived from loaded data (not a fetch input), so it's
         * applied via the auto-pick autorun rather than read into rpcProps.
         *
         * Regions are scanned in ascending index order, not rpcDataMap insertion
         * order, so ties break the same way every load. Exact ties at the top are
         * routine — `negLog10` clamps every underflowed p=0 to the same ~323.3 —
         * and rpcDataMap is cleared and refilled in RPC-resolution order on each
         * recolor. Adopting whichever tied SNP happened to land first would make
         * topSnp flip between them, and since adopting it refetches, the display
         * would livelock and never paint (see ldAutoIndex.test.ts).
         */
        get topSnp(): string | undefined {
          let bestScore = -Infinity
          let bestPos = 0
          let bestIdx = -1
          const indexes = [...self.rpcDataMap.keys()].sort((a, b) => a - b)
          for (const idx of indexes) {
            // hoisted out of the loop: this walks every SNP of every loaded
            // region, and a whole-genome GWAS puts hundreds of thousands in
            // each, so the two array lookups are the loop body
            const { y, x, count } = self.rpcDataMap.get(idx)!
            for (let i = 0; i < count; i++) {
              const s = y[i]!
              if (s > bestScore) {
                bestScore = s
                bestPos = x[i]!
                bestIdx = idx
              }
            }
          }
          const view = self.host
          const refName =
            bestIdx === -1 ? undefined : view.displayedRegions[bestIdx]?.refName
          return refName ? `${refName}:${bestPos + 1}` : undefined
        },
        /**
         * #getter
         * true when LD coloring is active with data loaded, but no region's LD
         * data referenced the index SNP — so every point is grey. LD is a
         * single-region analysis, so "found in no loaded region" means missing.
         *
         * Panning is no longer one of the ways in: the LD read is anchored on
         * the index rather than on the viewport (`ldQueryWindow`), so a loaded
         * region on the index's own contig finds it wherever the view has
         * moved to. What is left is the index being absent from the file,
         * named differently there than in the GWAS file, or on a contig none
         * of the loaded regions are.
         */
        get indexSnpMissing(): boolean {
          return (
            self.ldColoringActive &&
            self.indexSnp !== undefined &&
            self.rpcDataMap.size > 0 &&
            ![...self.rpcDataMap.values()].some(d => d.indexFound)
          )
        },
        /**
         * #getter
         * Fills MultiRegionDisplayMixin's supersession hook: the loaded data was
         * colored under an index SNP the auto-pick is about to replace with the
         * top hit, so `setIndexSnp` — an `rpcProps` field — will clear it and
         * refetch.
         *
         * The condition is the auto-pick's own, the `ld` scale rather than
         * `ldColoringActive`: what invalidates the load is the WRITE, and the
         * autorun writes whether or not an `ldAdapter` is configured. Gating
         * this on the adapter left `{ field: 'ld' }` with none — a config the
         * getters above document as supported — exporting the empty lane this
         * exists to prevent. On screen that is one invisible tick; an export samples
         * `svgReady` once, and sampling it here captured the doomed load and
         * painted the emptied map, which is a Manhattan lane with no points in
         * it and the LD legend beside it.
         */
        get dataSuperseded(): boolean {
          return (
            isLdColoring(self.color) &&
            !self.indexSnpPinned &&
            this.topSnp !== undefined &&
            this.topSnp !== self.indexSnp
          )
        },
        /**
         * #getter
         * `LegendMixin`'s hook: the scale the active scheme paints through,
         * or none under the single color, which has no key. The r² bins under
         * LD coloring; under field coloring the values the loaded regions met,
         * read off the payloads' scale tables — the same table the worker
         * packed `color` from, so a swatch is a color that was drawn. The chrome draws the key on screen and in the export.
         */
        get colorScales(): ColorScale[] {
          if (self.ldColoringActive) {
            return [ldScale(self.color, this.indexSnpMissing)]
          }
          const { scale, field, domain, palette } = self.color
          if (scale === 'threshold') {
            // `field: 'ld'` with no adapter paints `value`, so it keys nothing.
            if (isLdColoring(self.color)) {
              return []
            }
            const labels = thresholdLabels(numericDomain(domain))
            const colors = thresholdPalette(labels.length, palette)
            return [
              {
                kind: 'categorical',
                id: 'field',
                title: field,
                entries: labels.map((label, i) => ({
                  value: label,
                  label,
                  color: colors[i]!,
                })),
              },
            ]
          }
          if (scale === 'categorical') {
            // Every point of a region carries the same table, so the region is
            // its own source and every entry paints: the display has no rows
            // to hide a color behind.
            return derivedColorScale(
              self.rpcDataMap.values(),
              ({ scale }) => ({
                candidates:
                  scale?.kind === 'categorical'
                    ? scale.entries.map(entry => ({ rowIndex: 0, ...entry }))
                    : [],
                rowPaintsCandidateColor: () => true,
              }),
              {
                id: 'field',
                field: categoricalField(field, { domain, palette }),
                maxItems: MAX_LEGEND_ENTRIES,
              },
            )
          }
          return []
        },
      }))
      .actions(self => {
        // `self.color` is the colour as painted, LD's default cuts and palette
        // filled in, so neither write below reads it back into the config
        function colorBy(field: string) {
          if (field === self.color.field) {
            setConf(self, ['color', 'scale'], undefined)
          } else {
            setConf(self, 'color', { value: self.color.value, field })
          }
        }
        return {
          /**
           * #action
           * open the feature details widget for a clicked point
           */
          selectFeature(hit: ManhattanHit) {
            openFeatureWidget(self, {
              uniqueId: `manhattan-${hit.refName}-${hit.start}`,
              refName: hit.refName,
              start: hit.start,
              end: hit.end,
              score: hit.score,
              r2: hit.r2,
            })
          },
          /**
           * #action
           * Stage a region as fetched — the store's raw write with this
           * display's payload shape, so a test stands up a loaded display in one
           * call. Production goes through `ctx.commitRegion`.
           */
          setRpcData(idx: number, data: ManhattanRpcResult, region: Region) {
            self.setLoadedRegion(idx, region, storedManhattanData(data))
          },
          /**
           * #action
           * `none` paints every point `value`; `categorical` paints the field
           * again. The scale alone, so switching back to the field finds its
           * order and palette as written.
           */
          setColorScale(scale: Exclude<ManhattanColorScale, 'threshold'>) {
            setConf(self, ['color', 'scale'], scale)
          },
          /**
           * #action
           * Color by the values of a feature field. Re-picking the field keeps
           * its order and palette; a new field starts from neither.
           */
          colorByField(field: string) {
            colorBy(field)
          },
          /**
           * #action
           * Color each point by its r² to the index SNP: the `ld` field, read
           * from the adapter's `ldAdapter`.
           */
          colorByLd() {
            colorBy(LD_FIELD)
          },
          /**
           * #action
           * Score to draw the threshold line at; undefined removes it.
           */
          setSignificanceLine(score?: number) {
            setConf(self, 'significanceLine', score)
          },
          /**
           * #action
           */
          setIndexSnp(snp?: string) {
            self.indexSnp = snp
          },
          /**
           * #action
           * right-click "Color by LD to this SNP": switch into LD mode and pin the
           * index on the clicked point, so the auto-pick stops tracking the top hit.
           * Keyed by chr:bp (1-based) to match the worker's posKey. All mutations
           * happen in one action so rpcProps settles once and only a single recolor
           * fetch fires.
           */
          colorByLdToHit(hit: ManhattanHit) {
            colorBy(LD_FIELD)
            self.indexSnp = `${hit.refName}:${hit.start + 1}`
            self.indexSnpPinned = true
          },
          /**
           * #action
           * release a pinned index back to auto-tracking, seeded at the current top
           * hit (the auto-pick autorun then keeps it on the top hit as data loads)
           */
          // eslint-disable-next-line @eslint-react/no-unnecessary-use-prefix -- MST action named for its semantic meaning, not a React hook
          useTopHitAsIndex() {
            self.indexSnpPinned = false
            self.indexSnp = self.topSnp
          },
        }
      })
      .views(self => ({
        /**
         * #method
         * Manhattan track menu: shared Score submenu plus LD-coloring controls.
         * Rendering type / Resolution / Scale type don't apply to single-point
         * rendering of pre-transformed -log10 p values. Placed after the
         * color/index actions so referencing them doesn't make MST inference
         * circular.
         */
        trackMenuItems() {
          return [
            // Neither radio is drawn, because `scales.y` declares one scale
            // type and no autoscale mode: the domain is plain min/max over the
            // loaded regions with the manual bounds applied on top. Set min/max
            // score is the one score control that does anything here.
            makeScoreSubMenu(self, { domain: self.domain }),
            ...makePointSizeSubMenu(self, {
              label: 'Point size',
              applies: true,
            }),
            {
              // The score is shown in the label when one is set, the same way
              // the min/max row above does it: a horizontal line on a plot with
              // no p-value is meaningless until you know what number it is at.
              label:
                self.significanceLine === undefined
                  ? 'Set significance line...'
                  : `Set significance line (${self.significanceLine})...`,
              icon: HorizontalRuleIcon,
              onClick: () => {
                getDialogHost(self).queueDialog(handleClose => [
                  SetSignificanceLineDialog,
                  { display: self, handleClose },
                ])
              },
            },
            ...makeShowSubMenu([
              makeCrossHatchItem(self),
              legendCheckboxItem(self, {
                disabled: !(
                  self.ldColoringActive || self.color.scale === 'categorical'
                ),
                disabledHelpText:
                  'Requires LD or field coloring; a single color has no key',
              }),
            ]),
            {
              label: 'Color by',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Single color',
                  type: 'radio' as const,
                  checked: self.color.scale === 'none',
                  onClick: () => {
                    self.setColorScale('none')
                  },
                },
                {
                  label:
                    self.color.scale === 'categorical'
                      ? `Field (${self.color.field})...`
                      : 'Field...',
                  type: 'radio' as const,
                  checked: self.color.scale === 'categorical',
                  onClick: () => {
                    getDialogHost(self).queueDialog(handleClose => [
                      SetColorFieldDialog,
                      { display: self, handleClose },
                    ])
                  },
                },
                {
                  label: 'LD to index SNP',
                  type: 'radio' as const,
                  checked: isLdColoring(self.color),
                  disabled: !self.hasLdData,
                  disabledHelpText:
                    'Requires a configured LD (PLINK .ld) adapter',
                  onClick: () => {
                    self.colorByLd()
                  },
                },
              ],
            },
            {
              // whole submenu greys out without a configured .ld adapter
              label: 'LD options',
              disabled: !self.hasLdData,
              disabledHelpText: 'Requires a configured LD (PLINK .ld) adapter',
              subMenu: [
                {
                  label: 'Set index SNP to top hit',
                  disabled:
                    !isLdColoring(self.color) ||
                    !self.topSnp ||
                    !self.indexSnpPinned,
                  onClick: () => {
                    self.useTopHitAsIndex()
                  },
                },
              ],
            },
          ]
        },
        /**
         * #method
         * right-click menu for the point in `contextMenuInfo`: feature details
         * plus, when an LD adapter is configured, a shortcut to recolor by LD
         * to that SNP
         */
        contextMenuItems(): MenuItem[] {
          const hit = self.contextMenuInfo?.hit
          if (!hit) {
            return []
          }
          return [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                self.selectFeature(hit)
              },
            },
            ...(self.hasLdData
              ? [
                  {
                    label: `Color by LD to ${hit.refName}:${toLocale(hit.start + 1)}`,
                    onClick: () => {
                      self.colorByLdToHit(hit)
                    },
                  },
                ]
              : []),
          ]
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        fetchNeeded(needed: IndexedRegion[]) {
          return fetchEachRegion(self, needed, {
            call: (region, ctx) =>
              ctx.callRpc('GetManhattanData', { ...rpcArgs(self), region }),
            onResult: (_idx, result) => storedManhattanData(result),
          })
        },
        /**
         * #action
         * identity encode — RPC result is the upload payload
         */
        startRenderingBackend(backend: ManhattanRenderingBackend) {
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
      // Its own block, after `startRenderingBackend`: the export types `self` as
      // the same `ManhattanDisplayModel` slice the component takes, and MST
      // doesn't type a block's own members onto its `self`, so declaring this
      // alongside them left that contract unsatisfied.
      .actions(self => ({
        /**
         * #action
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => {
        return {
          afterAttach() {
            // LocusZoom-style default: while no index SNP is pinned, keep the
            // index anchored on the highest-scoring loaded SNP, re-tracking it as
            // higher-scoring data lands.
            //
            // indexSnp is both a fetch input (rpcProps bakes per-feature color on
            // the worker, so changing it clears every loaded region) and derived
            // from the loaded data, so this only settles when it reads a
            // *complete* load: mid-batch, topSnp is the winner among whatever
            // arrived so far, and adopting it invalidates the very data that
            // produced it. Unless the top hit is in the first region to land, the
            // index then flips between each partial winner and the true one,
            // refetching forever and never painting. loadedRegions is committed
            // only once a batch fully resolves, making topSnp a fixpoint here, so
            // adopting it costs one recolor fetch and converges. The && chain also
            // keeps the topSnp rescan off every other coloring path.
            namedAutorun(
              self,
              () => {
                if (
                  isLdColoring(self.color) &&
                  !self.indexSnpPinned &&
                  self.viewportWithinLoadedData &&
                  !self.isLoading &&
                  self.topSnp &&
                  self.topSnp !== self.indexSnp
                ) {
                  self.setIndexSnp(self.topSnp)
                }
              },
              { name: 'ManhattanAdoptTopSnp' },
            )

            // `flatbushes` is read only by the hit test, which runs in a
            // pointer handler where nothing is tracked — and MobX discards an
            // unobserved computed's value as it hands it over, so every
            // rAF-coalesced mousemove rebuilt the map. Held for the same reason
            // canvas holds `CanvasHitIndexes`, and safe for the same one: its
            // dependencies are the store, never per-frame view geometry.
            namedAutorun(
              self,
              () => {
                void self.flatbushes
              },
              { name: 'ManhattanHitIndexes' },
            )
          },
        }
      })
  )
}

export type LinearManhattanDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearManhattanDisplayModel =
  Instance<LinearManhattanDisplayStateModel>

// Compile-time proof the real MST model still satisfies the structural type its
// component takes. A `DisplayType`'s `ReactComponent` is typed
// `AnyReactComponentType`, so registering the pair erases the prop type and a
// renamed/dropped field would be a silent runtime failure inside the lazy
// component. The slice itself stays hand-rolled for `renderSvg.tsx`'s sake —
// see manhattanDisplayTypes.ts. Type-only, so it's erased at runtime; it lives
// in this file (not a standalone one) so a "remove files with no importers"
// sweep can't drop the guard.
type _ComponentContract<T extends ManhattanDisplayModel> = T
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesComponentContract =
  _ComponentContract<LinearManhattanDisplayModel>
