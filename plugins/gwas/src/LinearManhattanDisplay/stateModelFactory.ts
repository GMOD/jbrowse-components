import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  makePin,
  resolveConf,
  setConf,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { showLegendCheckboxItem } from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
  toLocale,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import MultiRegionDisplayMixin, {
  fetchEachRegion,
} from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { WiggleScoreConfigMixin } from '@jbrowse/plugin-wiggle'
import { installUpload } from '@jbrowse/render-core/installUpload'
import { regionDataMap } from '@jbrowse/render-core/regionDataMap'
import {
  SCALE_TYPE_LINEAR,
  axisPlotBox,
  computeYTicks,
  makeCrossHatchItem,
  makeScatterPointSizeMenuItem,
  makeScoreNormalizer,
  makeScoreSubMenu,
  resolveRenderState,
  scoreRuleMarks,
  visibleStatsDomain,
  widenRangeToRules,
} from '@jbrowse/wiggle-core'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot'
import { autorun } from 'mobx'

import { exportRCode } from './exportRCode.ts'
import { isIndexSnpOffscreen } from './isIndexSnpOffscreen.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanDisplayModel } from './components/manhattanDisplayTypes.ts'
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
import type { Region } from '@jbrowse/core/util'
import type { RTrackFragment } from '@jbrowse/display-kit/RExportFragment'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { VisibleEntry } from '@jbrowse/wiggle-core'

// The Manhattan walker: the worker ships each region's score extremes already
// reduced, so the domain is their min/max rather than a scan of the scores.
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
      .volatile(() => ({
        // 1:1 points keyed by displayedRegionIndex.
        rpcDataMap: regionDataMap<ManhattanRpcResult>('rpcDataMap'),
        // Wrapped Flatbush per region. Kept in lockstep with rpcDataMap so
        // a single-region fetch only re-wraps that region (whole-genome views
        // land 20+ regions serially; a derived view would re-wrap them all).
        flatbushes: regionDataMap<Flatbush>('flatbushes'),
        // Currently hovered point — drives the hover circle + tooltip. Named
        // apart from the `hoveredFeature` getter below it fills, because
        // `BaseDisplay` declares that hook as a computed and MST refuses to
        // instantiate a volatile over one.
        hoveredManhattanHit: undefined as ManhattanHit | undefined,
      }))
      .views(self => ({
        /**
         * #getter
         * Fills `BaseDisplay`'s cross-display hover hook.
         */
        get hoveredFeature() {
          return self.hoveredManhattanHit
        },
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
         * resolved coloring mode: 'normal' uses `color`, 'ld' colors by r² to the
         * index SNP
         */
        get colorBy(): 'normal' | 'ld' {
          return getConf(self, 'colorBy')
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
         * Whether the LD color key is drawn. Resolved through the
         * promotable-slot tiers (resolveConf): an explicit track value
         * customizes it either way, otherwise it follows the session-wide
         * default for this display type, falling back to on.
         *
         * Config-backed rather than volatile, which it was until this became a
         * slot: a volatile reset on every retick, so turning the key off lasted
         * until the track was hidden and reshown. It reads as a setting in the
         * menu and now behaves like one.
         */
        get showLdLegend(): boolean {
          return resolveConf(self, 'showLdLegend')
        },
        /**
         * #getter
         * "make the current LD-key visibility the default for all tracks"
         * control (pin): symmetric, so it promotes whichever value the track
         * shows.
         */
        get showLdLegendDisplayTypeDefault() {
          return makePin(self, 'showLdLegend')
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
            view: getContainingView(self) as LinearGenomeViewModel,
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
         * fetch inputs watched by SettingsInvalidate — any change (color, colorBy,
         * index SNP, LD adapter) triggers a refetch, since the worker bakes
         * per-feature color into the result
         */
        rpcProps(): {
          color: string
          colorBy: 'normal' | 'ld'
          indexSnp: string | undefined
          ldAdapterConfig: Record<string, unknown> | undefined
        } {
          return {
            color: self.color,
            colorBy: self.colorBy,
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
         * displayedRegionIndex → refName lookup. Hit-testing reads this on every
         * mousemove; MobX caches the view so visibleRegions changes invalidate it
         * once rather than rebuilding per event.
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
         * When the index SNP is a `chr:bp` locus, whether it lies outside every
         * visible region — the benign, pannable cause of `indexSnpMissing`
         * (PLINK `--ld-window` files carry no records once you pan away from the
         * index), as opposed to reference-name aliasing or the SNP being absent
         * from the file. A bare rsID index returns false since its position isn't
         * known here.
         */
        get indexSnpOffscreen(): boolean {
          return isIndexSnpOffscreen(self.indexSnp, self.host.visibleRegions)
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
         */
        setRpcData(idx: number, data: ManhattanRpcResult) {
          self.rpcDataMap.set(idx, data)
          if (data.flatbushData) {
            self.flatbushes.set(idx, Flatbush.from(data.flatbushData))
          } else {
            self.flatbushes.delete(idx)
          }
        },
        /**
         * #action
         */
        setHoveredFeature(hit: ManhattanHit | undefined) {
          self.hoveredManhattanHit = hit
        },
        /**
         * #action
         */
        setShowLdLegend(val: boolean) {
          setConf(self, 'showLdLegend', val)
        },
        /**
         * #action
         */
        setColorBy(mode: 'normal' | 'ld') {
          setConf(self, 'colorBy', mode)
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
        /**
         * #action
         */
        clearDisplaySpecificData() {
          self.rpcDataMap.clear()
          self.flatbushes.clear()
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
            {
              label: 'Point size',
              icon: ScatterPlotIcon,
              subMenu: [
                makeScatterPointSizeMenuItem(self, { label: 'Point size' }),
              ],
            },
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
                getSession(self).queueDialog(handleClose => [
                  SetSignificanceLineDialog,
                  { display: self, handleClose },
                ])
              },
            },
            ...makeShowSubMenu([
              makeCrossHatchItem(self),
              showLegendCheckboxItem(
                self.showLdLegend,
                () => {
                  self.setShowLdLegend(!self.showLdLegend)
                },
                {
                  disabled: !self.ldColoringActive,
                  disabledHelpText: 'Requires LD coloring to be active',
                  pin: self.showLdLegendDisplayTypeDefault,
                },
              ),
            ]),
            {
              // whole submenu greys out without a configured .ld adapter
              label: 'LD options',
              disabled: !self.hasLdData,
              disabledHelpText: 'Requires a configured LD (PLINK .ld) adapter',
              subMenu: [
                {
                  label: 'Color by LD to index SNP',
                  type: 'checkbox' as const,
                  checked: self.colorBy === 'ld',
                  onClick: () => {
                    self.setColorBy(self.colorBy === 'ld' ? 'normal' : 'ld')
                  },
                },
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
         * right-click menu for a clicked point: feature details plus, when an LD
         * adapter is configured, a shortcut to recolor by LD to that SNP
         */
        contextMenuItems(hit: ManhattanHit): MenuItem[] {
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
        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          const { adapterConfig } = self
          return fetchEachRegion(self, needed, {
            call: (region, ctx) =>
              ctx.callRpc('GetManhattanData', {
                adapterConfig,
                region,
                ...self.rpcProps(),
              }),
            onResult: (idx, result) => {
              self.setRpcData(idx, result)
            },
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
          // No superAfterAttach() call: the fork auto-chains hooks, so
          // MultiRegionDisplayMixin's afterAttach already runs (see
          // afterAttachAutoChain.test.ts). An explicit call would double-install
          // its fetch autoruns.
          /**
           * #action
           * Fills `BaseDisplay`'s hover-clear hook, which the fetch
           * foundation's reaction calls on every viewport change.
           *
           * The hover highlight is a DOM ring positioned from the hit's
           * screenX/screenY, captured when the pointer last moved — so a
           * pan/zoom/scroll under a stationary cursor (none of which fires a
           * mousemove over a painted canvas) leaves it parked on empty space
           * while the tooltip beside it describes a SNP that has moved. All
           * three axes, not just bpPerPx: see
           * `installClearHoverOnViewportChange`.
           */
          clearHoveredFeature() {
            self.setHoveredFeature(undefined)
          },

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
            addDisposer(
              self,
              autorun(() => {
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
              }),
            )
          },
        }
      })
      .views(self => ({
        /**
         * #method
         * Build the R ggplot fragment for this track, used by the view's
         * "Export R script" to regenerate the Manhattan panel from source in
         * ggplot2.
         */
        exportRCode(): RTrackFragment | undefined {
          return exportRCode(self as LinearManhattanDisplayModel)
        },
      }))
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
