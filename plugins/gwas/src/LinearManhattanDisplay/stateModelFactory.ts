import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { showLegendCheckboxItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost, openFeatureWidget, toLocale } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { ContextMenuMixin } from '@jbrowse/display-kit/ContextMenuMixin'
import LegendMixin from '@jbrowse/display-kit/LegendMixin'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { fetchEachRegion } from '@jbrowse/display-kit/fetchEachRegion'
import { rpcArgs } from '@jbrowse/display-kit/rpcArgs'
import { types } from '@jbrowse/mobx-state-tree'
import {
  WiggleScoreConfigMixin,
  makePointSizeSubMenu,
} from '@jbrowse/plugin-wiggle'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import {
  SCALE_TYPE_LINEAR,
  axisPlotBox,
  computeYTicks,
  makeCrossHatchItem,
  makeScoreNormalizer,
  makeScoreSubMenu,
  resolveRenderState,
  scoreRuleMarks,
  visibleStatsDomain,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'

import { LD_LEGEND, LD_LEGEND_TITLE } from './ldBins.ts'

import type {
  ManhattanColorBy,
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
import type { LegendItem, LegendSpec } from '@jbrowse/core/ui/legendSpec'
import type { Region } from '@jbrowse/core/util/types/data'
import type { IndexedRegion } from '@jbrowse/display-kit/planRegionFetch'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { VisibleEntry } from '@jbrowse/wiggle-core'

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
    if (data.scoreMin < scoreMin) {
      scoreMin = data.scoreMin
    }
    if (data.scoreMax > scoreMax) {
      scoreMax = data.scoreMax
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

// The color key under field coloring: every value any loaded region met, each
// with the color the worker packed for it. One value can arrive from several
// regions and always with the same color (`categoricalValueColor` is a
// function of the value), so the union is a plain first-wins merge, sorted
// numerically where the values are numbers so `chr2` files before `chr10`.
function categoryLegendItems(
  entries: Iterable<ManhattanRpcResult>,
): LegendItem[] {
  const byValue = new Map<string, string>()
  for (const { categories } of entries) {
    for (const { value, color } of categories ?? []) {
      if (!byValue.has(value)) {
        byValue.set(value, color)
      }
    }
  }
  return [...byValue]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, color]) => ({ label, color }))
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
        WiggleScoreConfigMixin(),
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
         * The `color` slot — a CSS color, or a `jexl:` expression — forwarded to
         * the worker, which binds `feature` and evaluates it once per point
         * (`makeColorEvaluator`).
         *
         * Reads the raw slot value, not `getConf`: this is a transport read, and
         * `getConf` evaluates a callback against whatever context the call
         * passes, which here is none. `get(feature,…)` against no feature throws
         * `reading 'get'`, and that escaped this getter and bannered the whole
         * display. Pinned end-to-end by colorSlotTransport.test.ts.
         */
        get color(): string {
          return self.conf.color
        },
        /**
         * #getter
         * resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to
         * the index SNP, 'field' by the distinct values of `colorField`
         */
        get colorBy(): ManhattanColorBy {
          return getConf(self, 'colorBy')
        },
        /**
         * #getter
         * the feature field 'field' coloring reads
         */
        get colorField(): string {
          return getConf(self, 'colorField')
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
         * LD coloring needs a configured .ld adapter; without one the
         * colorBy='ld' controls are inert, so they're hidden/disabled
         */
        get hasLdData(): boolean {
          return this.ldAdapterConfig !== undefined
        },
        /**
         * #getter
         * LD coloring is actually in effect — the mode is on *and* there's an .ld
         * adapter for it to read. `colorBy` alone can be 'ld' from config with no
         * adapter configured, in which case the worker silently falls back to
         * normal coloring, so every LD affordance (legend, missing-index warning)
         * keys off this rather than off `colorBy`.
         */
        get ldColoringActive(): boolean {
          return this.colorBy === 'ld' && this.hasLdData
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
         * so an explicit `minScore`/`maxScore` still wins.
         */
        get domain() {
          const line = this.significanceLine
          return visibleStatsDomain({
            active: true,
            view: self.host,
            payloadFor: index => self.rpcDataMap.get(index),
            itemsFor: data => (data.numFeatures === 0 ? [] : [data]),
            accumulate: shippedExtremes,
            range: ({ scoreMin, scoreMax }) =>
              widenRangeToRules(
                [scoreMin, scoreMax],
                line === undefined ? [] : [line],
              ),
            bounds: [self.minScoreBound, self.maxScoreBound],
            scaleType: 'linear',
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         * y-axis tick positions. Manhattan plots are linear-only (pre-transformed
         * -log10 p values); the inherited scaleType config is intentionally
         * ignored so the axis ticks stay consistent with the linear `domain`.
         */
        get ticks() {
          return computeYTicks({
            height: self.height,
            domain: self.domain,
            scaleType: 'linear',
            minimalTicks: getConf(self, 'minimalTicks'),
          })
        },
        /**
         * #getter
         * The threshold as a score rule, or `[]` when the slot is unset. Both
         * the on-screen overlay and the SVG export take the line from here, so
         * an exported figure cannot draw it at a different height than the
         * screen did.
         *
         * A one-element read of the same `scoreRuleMarks` the wiggle displays
         * place their configured rules with: this display's threshold is a rule
         * at a chosen score, which is what that helper is. Manhattan pins its
         * axis linear (see `domain`), so the normalizer is the linear one.
         *
         * The helper still drops a rule outside the domain, which here only
         * happens where `domain` could not widen to it: an explicit
         * `minScore`/`maxScore` bound that excludes the line.
         */
        get scoreRuleMarks() {
          const line = self.significanceLine
          const domain = self.domain
          if (line === undefined || !domain) {
            return []
          }
          const [min, max] = domain
          return scoreRuleMarks({
            rules: [{ value: line, color: SIGNIFICANCE_LINE_COLOR }],
            domain,
            box: axisPlotBox(self.height),
            normalize: makeScoreNormalizer(min, max, SCALE_TYPE_LINEAR),
          })
        },
        /**
         * #method
         * fetch inputs watched by SettingsInvalidate — any change (score field,
         * color, colorBy, color field, index SNP, LD adapter) triggers a
         * refetch, since the worker reads the field and bakes per-feature
         * color into the result
         */
        rpcProps(): {
          scoreField: string
          color: string
          colorBy: ManhattanColorBy
          colorField: string
          indexSnp: string | undefined
          ldAdapterConfig: Record<string, unknown> | undefined
        } {
          return {
            scoreField: self.scoreField,
            color: self.color,
            colorBy: self.colorBy,
            colorField: self.colorField,
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
         * displayedRegionIndex → refName lookup.
         *
         * Rebuilt per mousemove, NOT cached: its only reader is `computeHit`,
         * which runs in a pointer handler where nothing is tracked, and MobX
         * discards an unobserved computed's value as it hands it over. One entry
         * per visible region — typically one to three — so the rebuild is a Map
         * of a few strings and is left alone deliberately. A version that walked
         * the loaded data would want the keep-alive autorun canvas installs as
         * `CanvasHitIndexes`.
         */
        get regionRefNames(): ReadonlyMap<number, string> {
          const view = self.host
          return new Map(
            view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
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
            const { scores, positions, numFeatures } = self.rpcDataMap.get(idx)!
            for (let i = 0; i < numFeatures; i++) {
              const s = scores[i]!
              if (s > bestScore) {
                bestScore = s
                bestPos = positions[i]!
                bestIdx = idx
              }
            }
          }
          // refName from displayedRegions (not visible-only regionRefNames):
          // rpcDataMap keeps buffered regions that may have scrolled off-screen,
          // and the top hit can live in one of them — resolving via visible
          // regions alone would drop it and stall the LD auto-index autorun.
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
         * The condition is the auto-pick's own, `colorBy === 'ld'` rather than
         * `ldColoringActive`: what invalidates the load is the WRITE, and the
         * autorun writes whether or not an `ldAdapter` is configured. Gating
         * this on the adapter left `colorBy: 'ld'` with none — a config the
         * getters above document as supported — exporting the empty lane this
         * exists to prevent. On screen that is one invisible tick; an export samples
         * `svgReady` once, and sampling it here captured the doomed load and
         * painted the emptied map, which is a Manhattan lane with no points in
         * it and the LD legend beside it.
         */
        get dataSuperseded(): boolean {
          return (
            self.colorBy === 'ld' &&
            !self.indexSnpPinned &&
            this.topSnp !== undefined &&
            this.topSnp !== self.indexSnp
          )
        },
        /**
         * #getter
         * The color key, or undefined under the single-color scheme, which has
         * none. The r² bins under LD coloring; under field coloring the values
         * the loaded regions met, read off the payloads' `categories` tables
         * — the same table the worker packed `colors[]` from, so a swatch is a
         * color that was drawn. The on-screen key and the SVG export both
         * render this one value.
         */
        get legend(): LegendSpec | undefined {
          if (self.ldColoringActive) {
            return { title: LD_LEGEND_TITLE, items: LD_LEGEND }
          }
          if (self.colorBy === 'field') {
            const items = categoryLegendItems(self.rpcDataMap.values())
            return items.length ? { title: self.colorField, items } : undefined
          }
          return undefined
        },
      }))
      .actions(self => ({
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
         */
        setColorBy(mode: ManhattanColorBy) {
          setConf(self, 'colorBy', mode)
        },
        /**
         * #action
         * Color by the values of a feature field. Mode and field in one action
         * so rpcProps settles once and a single refetch fires.
         */
        colorByField(field: string) {
          setConf(self, 'colorBy', 'field')
          setConf(self, 'colorField', field)
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
          setConf(self, 'colorBy', 'ld')
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
      }))
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
            // scaleType and autoscale are both off because `domain` above
            // consults neither: -log10 p values are pre-transformed so the axis
            // is linear-only, and the domain is plain min/max over the loaded
            // regions with the manual bounds applied on top. Set min/max score
            // is the one score control that does anything here.
            makeScoreSubMenu(self, { scaleType: false, autoscale: false }),
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
              showLegendCheckboxItem(
                self.showLegend,
                () => {
                  self.setShowLegend(!self.showLegend)
                },
                {
                  disabled: self.colorBy === 'normal',
                  disabledHelpText:
                    'Requires LD or field coloring; a single color has no key',
                  pin: self.showLegendDisplayTypeDefault,
                },
              ),
            ]),
            {
              label: 'Color by',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Single color',
                  type: 'radio' as const,
                  checked: self.colorBy === 'normal',
                  onClick: () => {
                    self.setColorBy('normal')
                  },
                },
                {
                  label:
                    self.colorBy === 'field'
                      ? `Field (${self.colorField})...`
                      : 'Field...',
                  type: 'radio' as const,
                  checked: self.colorBy === 'field',
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
                  checked: self.colorBy === 'ld',
                  disabled: !self.hasLdData,
                  disabledHelpText:
                    'Requires a configured LD (PLINK .ld) adapter',
                  onClick: () => {
                    self.setColorBy('ld')
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
                    self.colorBy !== 'ld' ||
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
            // keeps the topSnp rescan off the 'normal' coloring path.
            namedAutorun(
              self,
              () => {
                if (
                  self.colorBy === 'ld' &&
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
