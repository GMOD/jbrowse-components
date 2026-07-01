import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  getConfSnapshot,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isFeature,
  openFeatureWidget,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, cast, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  autorunOnReadyView,
  evaluateRegionTooLarge,
  onDisplayedRegionsChange,
  resolveByteLimit,
} from '@jbrowse/plugin-linear-genome-view'
import { createRegionUploadSync } from '@jbrowse/render-core/regionUploadSync'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, observable, toJS, untracked } from 'mobx'

import {
  fetchCanvasFeatureDetails,
  findSubfeatureById,
  indexById,
  radioSubMenu,
  screenDensity,
} from './baseModelHelpers.ts'
import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { createIncrementalLayout } from './layout.ts'
import {
  canMorph,
  captureFeatureTops,
  easeInOutCubic,
  focusScrollDelta,
  interpolateYData,
  maxBottom,
} from './yMorph.ts'
import { THEME_DERIVED_COLOR } from '../RenderFeatureDataRPC/renderConfig.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { RegionDensityStats } from './baseModelHelpers.ts'
import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasFeatureRenderingBackend } from './components/canvasFeatureRenderingBackendTypes.ts'
import type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
  VisibleRegion,
} from './components/hitTesting.ts'
import type { LinearBasicDisplayConfigModel } from './configSchema.ts'
import type { ShowLabelsMode } from './showLabelsMode.ts'
// rpcTypes.ts also declares the RpcRegistry augmentation; importing any type
// from it is enough to make rpcManager.call() resolve to the typed args.
import type {
  FeatureDataResult,
  FlatbushItem,
  RenderFeatureDataResult,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { AnimationMode, Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// Region identity (regionKey/reversed) is stored alongside the data so layout
// grouping derives from rpcDataMap directly. Deriving it from loadedRegions
// instead would lag: loadedRegions is cleared on every settings change but
// rpcDataMap is preserved through the refetch window, and loadedRegions is
// populated one action after setRpcData. During that gap every region would
// collapse to one layout group and features from different refs would mis-stack.
type LoadedFeatureData = FeatureDataResult & {
  loadedBpPerPx: number
  regionKey: string
  reversed: boolean
}

export function getView(self: IAnyStateTreeNode): LGV {
  return getContainingView(self) as LGV
}

const morphClockMs = () =>
  typeof performance === 'undefined' ? 0 : performance.now()

// Animate only where a frame clock exists and the resolved animation mode
// allows it: 'enabled' always animates, 'disabled' never does, and 'system'
// honors the OS prefers-reduced-motion setting (so reduced-motion users get
// instant snaps unless they explicitly opt in). Mode comes from the session
// preference (configuration.preferences.animationMode + user override).
function morphAllowed(mode: AnimationMode) {
  const hasFrameClock = typeof requestAnimationFrame === 'function'
  const prefersReduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    hasFrameClock &&
    (mode === 'enabled' || (mode === 'system' && !prefersReduced))
  )
}

export type { Region } from '@jbrowse/core/util'

const ColorByAttributeDialog = lazy(
  () => import('./components/ColorByAttributeDialog.tsx'),
)
const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))
const AddFiltersDialog = lazy(() => import('./components/AddFiltersDialog.tsx'))

const STRAND_COLOR_JEXL =
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"

// Swatch fallback when the active color is a jexl (per-feature) expression
// rather than a solid CSS color. Mirrors the baseConfigSchema.ts color default.
const FEATURE_COLOR_DEFAULT = 'goldenrod'

// Floor for the auto-fit height so a sparse/empty track doesn't collapse to a
// sliver. Capped by the maxHeight config in fitHeight.
const MIN_FIT_HEIGHT = 50

/**
 * #stateModel LinearCanvasBaseDisplay
 * #category display
 *
 * Shared GPU-accelerated feature display base for canvas-rendered tracks.
 * Handles fetching, layout, the "Show labels" / "Show descriptions" UI, and
 * the fetch-invalidation autorun. Subclasses layer schema-specific properties
 * and menus via the showSubmenuMenuItems / trackMenuItems / contextMenuItems
 * super-extension pattern, and extend rpcProps() via the standard
 * super-capture pattern.
 */
export default function baseStateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return (
    types
      .compose(
        'LinearCanvasBaseDisplay',
        BaseDisplay,
        TrackHeightMixin(),
        MultiRegionDisplayMixin(),
        types.model({
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
          /**
           * #property
           * Runtime "Filter by..." override. When set (even to an empty list) it
           * replaces the `jexlFilters` config slot; when undefined the config
           * default applies. Stored as already-`jexl:`-prefixed expressions
           * (runtime convention), unlike the deferred-evaluation config slot.
           */
          jexlFiltersSetting: types.maybe(types.array(types.string)),
        }),
      )
      .volatile(() => ({
        /**
         * #volatile
         */
        rpcDataMap: observable.map<number, LoadedFeatureData>(),
        /**
         * #volatile
         */
        // Per-region density stats (featureCount over genomic span) populated
        // for both successful fetches and worker-side too-large responses.
        // Drives the derived `regionTooLarge` getter so banner state is a
        // pure function of cached data + current bpPerPx (no flicker on
        // small zoom changes).
        densityStatsPerRegion: observable.map<number, RegionDensityStats>(),
        /**
         * #volatile
         */
        featureIdUnderMouse: null as string | null,
        /**
         * #volatile
         */
        subfeatureIdUnderMouse: null as string | null,
        /**
         * #volatile
         */
        mouseoverExtraInformation: undefined as string | undefined,
        /**
         * #volatile
         */
        contextMenuFeature: undefined as Feature | undefined,
        /**
         * #volatile
         */
        contextMenuInfo: undefined as
          { item: FlatbushItem; displayedRegionIndex: number } | undefined,
        /**
         * #volatile
         */
        userFeatureDensityLimit: undefined as number | undefined,
        /**
         * #volatile
         */
        // visibleBp at which the current `featureDensityStats` byte estimate was
        // measured. The estimate scales with span, so a value taken while zoomed
        // out doesn't describe a smaller zoomed-in span; tracking the capture
        // span lets `estimatedVisibleBytes` rescale it to the current view
        // instead of letting a stale estimate gate refetch forever.
        byteEstimateVisibleBp: undefined as number | undefined,
        /**
         * #volatile
         */
        heightBeforeExpand: undefined as number | undefined,
        /**
         * #volatile
         */
        // Per-instance memo backing `laidOutDataMap`. Stateful (holds the
        // previous per-ref-group layout) so unchanged chromosomes keep stable
        // object references — turns whole-genome layout/upload from O(N²) to
        // O(N). The volatile holds a stable reference; mutating its internal
        // cache is invisible to MobX, so reading it in the computed is safe.
        incrementalLayout: createIncrementalLayout(),
        /**
         * #volatile
         */
        // Feature-Y transition state. While `morphFromTops` is set,
        // `renderDataMap` eases each feature from its previous row (id ->
        // topPx here) toward its `laidOutDataMap` row by `morphProgress` (0->1,
        // driven by a rAF clock). Render-only — hit-test and layout always read
        // the destination `laidOutDataMap`.
        morphFromTops: undefined as Map<string, number> | undefined,
        /**
         * #volatile
         */
        morphProgress: 1,
        morphStartMs: 0,
        // Height of the layout being animated away from; `maxY` holds at the
        // taller of this and the destination during a morph (anti-clip).
        morphFromMaxY: 0,
        // Scroll-follow so the focused feature stays put through a repack:
        // `scrollTop` eases from `morphScrollFrom` by `morphScrollDelta` (the
        // anchor feature's row shift) in lockstep with the Y morph. Zero when
        // there's nothing to pin. See focusScrollDelta.
        morphScrollFrom: 0,
        morphScrollDelta: 0,
      }))
      .views(self => ({
        /**
         * #getter
         * the config typed off the concrete schema; `ConfigurationReference`
         * erases `self.configuration` to `any`, so direct reads route through
         * this to stay typed (same move as `BaseAdapter<CONF>`).
         */
        get conf(): LinearBasicDisplayConfigModel {
          return self.configuration
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        // Highest features-per-pixel across the visible regions at the given
        // bpPerPx, from cached per-region counts. Shared by the density gate
        // (debounced coarseBpPerPx) and the force-load baseline (live bpPerPx).
        observedMaxDensity(bpPerPx: number) {
          return Math.max(
            0,
            ...getView(self).visibleRegions.map(r => {
              const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
              return ds ? screenDensity(ds, bpPerPx) : 0
            }),
          )
        },

        /**
         * #getter
         */
        // Current features-per-pixel across the visible regions, recomputed
        // from cached per-region counts and the debounced coarseBpPerPx (500ms
        // after the gesture settles). Drives label visibility and the
        // regionTooLarge banner; both also feed the coarse-packed layout, so
        // using coarseBpPerPx keeps all three on one cadence and avoids
        // per-frame relayout/banner flicker when a smooth zoom hovers near a
        // threshold. Still far faster than the old fetch-time snapshot.
        get visibleFeatureDensityPerPx() {
          return this.observedMaxDensity(getView(self).coarseBpPerPx)
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get renderState() {
          const view = getView(self)
          return {
            scrollY: self.scrollTop,
            canvasWidth: view.trackWidthPx,
            canvasHeight: self.height,
          }
        },

        /**
         * #getter
         */
        get DisplayMessageComponent() {
          return FeatureComponent
        },

        /**
         * #getter
         */
        get showTooltipsEnabled() {
          return false
        },

        /**
         * #getter
         */
        get showLegend() {
          return false
        },

        /**
         * #getter
         */
        get maxHeight() {
          return getConf(self, 'maxHeight')
        },

        /**
         * #getter
         */
        get autoHeight() {
          return getConf(self, 'autoHeight')
        },

        /**
         * #getter
         */
        get displayMode() {
          return getConf(self, 'displayMode')
        },

        /**
         * #getter
         */
        get showLabelsMode() {
          return getConf(self, 'showLabels')
        },

        /**
         * #getter
         */
        // Effective boolean visibility used by layout, hit testing, the DOM
        // overlay, and SVG export. 'auto' switches to false once feature
        // density crosses the readability threshold so layout-reserved label
        // space, the rendered DOM elements, and the hit-test geometry all
        // agree — otherwise rows reserve label height that never gets used.
        get showLabels() {
          const mode = this.showLabelsMode
          if (mode === 'off') {
            return false
          }
          if (mode === 'on') {
            return true
          }
          return (
            self.visibleFeatureDensityPerPx <=
            getConf(self, 'maxLabelFeatureDensity')
          )
        },

        /**
         * #getter
         */
        get showDescriptions() {
          return getConf(self, 'showDescriptions')
        },

        /**
         * #getter
         */
        get showOutline() {
          return !!getConf(self, 'outlineColor')
        },

        /**
         * #getter
         */
        // Solid color for the picker swatch. Reads the raw config `color`
        // slot value directly (self.conf.color, not getConf) so an unset or
        // jexl-expression color doesn't get evaluated without a feature —
        // jexl strings aren't valid CSS colors anyway, so they fall back to
        // the default swatch same as unset.
        get featureColor() {
          const raw = self.conf.color
          return raw !== undefined && !raw.startsWith('jexl:')
            ? raw
            : FEATURE_COLOR_DEFAULT
        },

        /**
         * #getter
         */
        get utrColor() {
          return getConf(self, 'utrColor')
        },

        /**
         * #getter
         */
        // Which "Color by..." choice is active, so the track menu can show a
        // radio checkmark. 'strand' is the exact built-in jexl; any other jexl
        // value is a per-attribute expression; anything else (a solid color)
        // reads as the default solid mode. Reads the raw slot value (not
        // getConf) — same jexl-without-a-feature hazard as featureColor.
        get colorByMode(): 'strand' | 'attribute' | 'solid' {
          const raw = self.conf.color
          if (raw === STRAND_COLOR_JEXL) {
            return 'strand'
          }
          return raw?.startsWith('jexl:') ? 'attribute' : 'solid'
        },

        /**
         * #getter
         */
        // The attribute name baked into an active "Color by attribute" jexl, so
        // the dialog reopens prefilled instead of blank. Empty unless that mode
        // is active.
        get colorByAttribute() {
          if (this.colorByMode !== 'attribute') {
            return ''
          }
          const raw = self.conf.color ?? ''
          return /get\(feature,'([^']+)'\)/.exec(raw)?.[1] ?? ''
        },

        /**
         * #getter
         */
        get effectiveShowDescriptions() {
          // In auto mode the density gate hides both labels and descriptions
          // together. Manual 'off' only hides labels — descriptions remain
          // independently controllable.
          return (
            this.showDescriptions &&
            (this.showLabelsMode !== 'auto' || this.showLabels)
          )
        },

        /**
         * #getter
         */
        get selectedFeatureId() {
          const selection = isAlive(self)
            ? getSession(self).selection
            : undefined
          return isFeature(selection) ? selection.id() : undefined
        },

        /**
         * #getter
         */
        get maxFeatureDensity() {
          // Skip density gating when the user has already force-loaded via byte estimate
          if (self.userByteSizeLimit !== undefined) {
            return undefined
          }
          const view = getView(self)
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return undefined
          }
          return (
            self.userFeatureDensityLimit ??
            getConf(self, 'maxFeatureScreenDensity')
          )
        },

        /**
         * #getter
         */
        get colorByCDS() {
          const view = getView(self)
          return view.colorByCDS
        },

        /**
         * #method
         * The filters actually applied, as `jexl:`-prefixed expressions. The
         * runtime override shadows the config slot when set; otherwise the
         * deferred-evaluation `jexlFilters` config slot is prefixed on read.
         * This is the single source of truth for both the worker (via rpcProps)
         * and the "Filter by..." dialog (so existing config filters show up and
         * are editable).
         */
        activeFilters(): string[] {
          return (
            toJS(self.jexlFiltersSetting) ??
            getConf(self, 'jexlFilters').map((f: string) => `jexl:${f}`)
          )
        },

        /**
         * #getter
         */
        get sequenceAdapter() {
          const { assemblyManager } = getSession(self)
          const track = getContainingTrack(self)
          const assemblyNames = readConfObject(
            track.configuration,
            'assemblyNames',
          ) as string[]
          const assembly = assemblyManager.get(assemblyNames[0]!)
          return assembly
            ? getConf(assembly, ['sequence', 'adapter'])
            : undefined
        },

        /**
         * #getter
         */
        get regionKeys() {
          const map = new Map<number, string>()
          for (const [num, data] of self.rpcDataMap) {
            map.set(num, data.regionKey)
          }
          return map
        },

        /**
         * #getter
         */
        get reversedRegions() {
          const set = new Set<number>()
          for (const [num, data] of self.rpcDataMap) {
            if (data.reversed) {
              set.add(num)
            }
          }
          return set
        },

        /**
         * #getter
         */
        get featureWidgetType() {
          return {
            type: 'BaseFeatureWidget',
            id: 'baseFeature',
          }
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        // User-controlled settings sent to the worker via RPC. Every field
        // read here becomes a cache key: SettingsInvalidate autorun calls
        // rpcProps() and clears data when any field changes. Structural args
        // (adapterConfig, sequenceAdapter, region, bpPerPx) are added at the
        // RPC call site, matching the pattern used by every other display
        // type. Subclasses extend via the super-capture pattern.
        rpcProps() {
          // showLabels/showDescriptions are display-only — exclude them so
          // toggling label visibility doesn't invalidate the RPC cache.
          // displayMode is also excluded: compact/superCompact scaling and
          // collapse-mode label decimation are applied on the main thread so
          // switching modes skips an RPC round-trip.
          const {
            showLabels: _l,
            showDescriptions: _d,
            displayMode: _dm,
            ...rest
          } = getConfSnapshot(self.configuration)
          return {
            // jexlFilters carries the effective runtime filters (mirrors the
            // effectiveGeneGlyphMode substitution in the concrete model); reading
            // activeFilters() here makes it an RPC cache key so toggling filters
            // refetches. buildFeatureAdmission normalizes the prefix either way.
            displayConfig: {
              ...rest,
              jexlFilters: self.activeFilters(),
            } as DisplayConfig,
            maxFeatureDensity: self.maxFeatureDensity,
            colorByCDS: self.colorByCDS,
            // Structurally-serializable theme description so worker-side coloring
            // (CDS frames, stroke fallback) matches the user's active theme; the
            // worker rebuilds the full theme via createJBrowseThemeFromArgs. The
            // created theme itself carries functions and can't cross the worker
            // boundary. Tracked here (not added at the call site) so switching
            // themes invalidates the RPC cache and refetches with new colors.
            theme: getSession(self).themeOptions,
          }
        },
      }))
      // Derived regionTooLarge: a pure function of cached stats × current
      // bpPerPx + visible regions. No imperative clear-and-reset, so small
      // zoom/pan moves don't flicker the banner. Shadows RegionTooLargeMixin's
      // imperative getter.
      .views(self => ({
        /**
         * #getter
         * The cached byte estimate scaled from the span it was measured over
         * (`byteEstimateVisibleBp`) to the currently visible span. The estimate
         * is roughly proportional to span, so scaling makes it a pure function
         * of the current view — mirroring densityTooLarge. Crucially it
         * self-releases on zoom-in: without scaling, a large zoomed-out estimate
         * stays above the limit forever and gates refetch (FetchVisibleRegions
         * won't re-estimate while regionTooLarge holds) — a permanently stuck
         * banner.
         */
        get estimatedVisibleBytes() {
          const stats = self.featureDensityStats
          if (!stats?.bytes) {
            return undefined
          }
          const captureBp = self.byteEstimateVisibleBp
          return captureBp
            ? (stats.bytes * getView(self).visibleBp) / captureBp
            : stats.bytes
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get densityTooLarge() {
          const max = self.maxFeatureDensity
          return max === undefined
            ? false
            : self.visibleFeatureDensityPerPx > max
        },
      }))
      .views(self => ({
        // Shared verdict + reason: bytes-over-limit takes precedence over
        // density, gated by AUTO_FORCE_LOAD_BP. Same helper as the block-based
        // and pre-fetch byte paths so the banner text can't drift. Feeds the
        // scaled estimatedVisibleBytes so the byte gate self-releases on
        // zoom-in (see estimatedVisibleBytes).
        get tooLargeStatus() {
          return evaluateRegionTooLarge({
            visibleBp: getView(self).visibleBp,
            bytes: self.estimatedVisibleBytes,
            byteLimit: resolveByteLimit({
              userByteSizeLimit: self.userByteSizeLimit,
              adapterFetchSizeLimit: self.featureDensityStats?.fetchSizeLimit,
              configFetchSizeLimit: readConfObject(self.conf, 'fetchSizeLimit'),
            }),
            densityTooLarge: self.densityTooLarge,
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get regionTooLarge() {
          return self.tooLargeStatus.tooLarge
        },

        /**
         * #getter
         */
        get regionTooLargeReason() {
          return self.tooLargeStatus.reason
        },
      }))
      // Laid-out data derived from the raw per-region fetch results. MobX
      // caches this — it only recomputes when any tracked input changes (raw
      // data, coarseBpPerPx, label visibility). coarseBpPerPx is debounced
      // 500ms so Y-row packing doesn't recompute on every animation frame
      // during smooth zoom. Every consumer (hit test, GPU upload, React
      // render) reads this getter and sees the same cached map until an
      // input moves. Returns empty when too-large so the GPU upload autorun
      // has nothing to push — banner UI hides the canvas, preventing stale flash.
      .views(self => ({
        /**
         * #getter
         */
        get laidOutDataMap(): Map<number, FeatureDataResult> {
          if (self.regionTooLarge) {
            return new Map()
          }
          const view = getView(self)
          if (!view.initialized || self.rpcDataMap.size === 0) {
            return new Map()
          }
          return self.incrementalLayout(self.rpcDataMap, {
            bpPerPx: view.coarseBpPerPx,
            regionKeys: self.regionKeys,
            showLabels: self.showLabels,
            showDescriptions: self.effectiveShowDescriptions,
            reversedRegions: self.reversedRegions,
            displayMode: self.displayMode,
          })
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        // What the canvas + DOM overlays actually draw. Identical to
        // `laidOutDataMap` except during a row re-pack, when feature Y eases
        // from the previous layout to the new one (see yMorph). Returns the
        // same object reference as `laidOutDataMap` when idle, so consumers
        // don't re-upload/re-render unless an animation is in flight.
        get renderDataMap(): Map<number, FeatureDataResult> {
          const from = self.morphFromTops
          if (from === undefined) {
            return self.laidOutDataMap
          }
          return interpolateYData(
            from,
            self.laidOutDataMap,
            easeInOutCubic(self.morphProgress),
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Start the feature-Y transition from `fromTops` (each feature's row in
        // the layout being left) toward the current `laidOutDataMap`. The rAF
        // clock that advances `morphProgress` lives in FeatureComponent (it
        // observes `morphFromTops`). Morphs (300ms) finish before the next
        // layout change (coarseBpPerPx is debounced 500ms), so no retarget.
        beginYMorph(
          fromTops: Map<string, number>,
          fromMaxY: number,
          scrollFrom: number,
          scrollDelta: number,
        ) {
          self.morphFromTops = fromTops
          self.morphFromMaxY = fromMaxY
          self.morphScrollFrom = scrollFrom
          self.morphScrollDelta = scrollDelta
          self.morphStartMs = morphClockMs()
          self.morphProgress = 0
        },
        /**
         * #action
         */
        setMorphProgress(t: number) {
          self.morphProgress = Math.min(1, Math.max(0, t))
          // Ease scrollTop by the same eased factor the rows use, so the anchor
          // feature holds its screen position while the rest morph around it.
          if (self.morphScrollDelta !== 0) {
            self.setScrollTop(
              self.morphScrollFrom +
                self.morphScrollDelta * easeInOutCubic(self.morphProgress),
            )
          }
        },
        /**
         * #action
         */
        endYMorph() {
          self.morphFromTops = undefined
          self.morphProgress = 1
          self.morphScrollDelta = 0
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get maxY() {
          const max = maxBottom(self.laidOutDataMap)
          // During a Y morph hold the height at the taller of the old/new
          // layout so features animating up from a deeper row aren't clipped at
          // the bottom; it settles to the destination height when the morph
          // ends. Constant across the morph, so no per-frame reflow.
          return self.morphFromTops === undefined
            ? max
            : Math.max(max, self.morphFromMaxY)
        },

        /**
         * #getter
         */
        get hasOverflow() {
          return this.maxY > self.height
        },

        /**
         * #getter
         */
        // Height that fits the laid-out content: the content height (maxY)
        // clamped to MIN_FIT_HEIGHT (so a sparse track doesn't collapse) and the
        // maxHeight cap. Single source for both the autoHeight autorun and the
        // manual expand-to-fit button.
        get fitHeight() {
          return Math.min(Math.max(this.maxY, MIN_FIT_HEIGHT), self.maxHeight)
        },

        /**
         * #getter
         */
        get featureIdIndex() {
          return indexById(self.laidOutDataMap, d => d.flatbushItems)
        },

        /**
         * #getter
         */
        get subfeatureIdIndex() {
          return indexById(self.laidOutDataMap, d => d.subfeatureInfos)
        },

        /**
         * #getter
         */
        get hoveredFeature() {
          const id = self.featureIdUnderMouse
          return id ? (this.featureIdIndex.get(id) ?? null) : null
        },

        /**
         * #getter
         */
        get hoveredSubfeature() {
          const id = self.subfeatureIdUnderMouse
          return id ? (this.subfeatureIdIndex.get(id) ?? null) : null
        },

        /**
         * #method
         */
        getFeatureById(featureId: string) {
          return this.featureIdIndex.get(featureId)
        },

        /**
         * #method
         */
        searchFeatureByID(id: string) {
          const item = this.getFeatureById(id)
          if (!item) {
            return undefined
          }
          return [item.startBp, item.topPx, item.endBp, item.bottomPx] as const
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        // Per-feature entry across visible regions, indexed by featureId.
        // Drives overlay rendering (hover/selection highlights) — keyed on
        // laidOutDataMap + view.visibleRegions, so it recomputes on layout
        // change, pan, or zoom. Feature wins over subfeature on id collision.
        get featureItemMap(): Map<string, FeatureItemEntry> {
          const map = new Map<string, FeatureItemEntry>()
          const visibleRegions = getView(self).visibleRegions as VisibleRegion[]
          for (const vr of visibleRegions) {
            const data = self.laidOutDataMap.get(vr.displayedRegionIndex)
            if (!data) {
              continue
            }
            for (const f of data.flatbushItems) {
              map.set(f.featureId, { kind: 'feature', item: f, vr, data })
            }
            for (const s of data.subfeatureInfos) {
              if (!map.has(s.featureId)) {
                map.set(s.featureId, { kind: 'subfeature', item: s, vr })
              }
            }
          }
          return map
        },

        /**
         * #getter
         */
        // Flatbush spatial indexes per region for hit testing. Recomputes when
        // any input observable moves (laid-out data, label visibility, zoom,
        // reversed flag); MobX caches the value so repeated hover events read
        // the same indexes for free.
        get flatbushIndexes() {
          const view = getView(self)
          const labels = {
            showLabels: self.showLabels,
            showDescriptions: self.effectiveShowDescriptions,
          }
          const reversedRegions = self.reversedRegions
          const bpPerPx = view.bpPerPx
          const result = new Map<number, FlatbushRegionIndexes>()
          for (const [idx, data] of self.laidOutDataMap) {
            result.set(idx, {
              feature: buildFeatureFlatbushIndex(
                data.flatbushItems,
                data.floatingLabelsData,
                bpPerPx,
                reversedRegions.has(idx),
                labels,
              ),
              subfeature: buildSubfeatureFlatbushIndex(data.subfeatureInfos),
            })
          }
          return result
        },
        /**
         * #method
         */
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        expandToFit() {
          self.heightBeforeExpand = self.height
          self.setHeight(self.fitHeight)
        },

        /**
         * #action
         */
        collapseFromExpand() {
          if (self.heightBeforeExpand !== undefined) {
            self.setHeight(self.heightBeforeExpand)
            self.heightBeforeExpand = undefined
          }
        },

        /**
         * #action
         */
        clearHeightBeforeExpand() {
          self.heightBeforeExpand = undefined
        },

        /**
         * #action
         */
        setRpcData(
          displayedRegionIndex: number,
          data: FeatureDataResult,
          loadedBpPerPx: number,
          region: Region,
        ) {
          self.rpcDataMap.set(displayedRegionIndex, {
            ...data,
            loadedBpPerPx,
            regionKey: `${region.assemblyName}:${region.refName}`,
            reversed: !!region.reversed,
          })
        },

        /**
         * #action
         */
        setDensityStats(
          displayedRegionIndex: number,
          stats: RegionDensityStats,
        ) {
          self.densityStatsPerRegion.set(displayedRegionIndex, stats)
        },

        /**
         * #action
         */
        clearDisplaySpecificData() {
          // Density stats survive viewport-change clearAllRpcData calls so
          // the derived `regionTooLarge` banner stays stable across small
          // zoom or pan moves. pruneRpcDataMapToVisible drops off-screen
          // entries during fetchNeeded. rpcDataMap is similarly preserved;
          // when regionTooLarge is true, laidOutDataMap returns empty so no
          // stale features render through the banner.
          self.setScrollTop(0)
        },

        /**
         * #action
         */
        pruneRpcDataMapToVisible(visibleDisplayedRegionIndices: Set<number>) {
          for (const key of self.rpcDataMap.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.rpcDataMap.delete(key)
            }
          }
          for (const key of self.densityStatsPerRegion.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.densityStatsPerRegion.delete(key)
            }
          }
          // Keep loadedRegions in sync with rpcDataMap so isCacheValid never
          // sees boundsValid=true with missing rpcData (blank-region on pan-back).
          for (const key of self.loadedRegions.keys()) {
            if (!visibleDisplayedRegionIndices.has(key)) {
              self.loadedRegions.delete(key)
            }
          }
        },

        /**
         * #action
         */
        startRenderingBackend(backend: CanvasFeatureRenderingBackend) {
          // Upload only regions whose laid-out data reference changed, so a
          // new chromosome streaming in doesn't re-upload the ones already on
          // the GPU. `laidOutDataMap` keeps stable references for unchanged
          // ref-groups (see createIncrementalLayout), making the diff
          // meaningful; createRegionUploadSync owns the pruning + the
          // context-loss reset.
          const syncRegions = createRegionUploadSync<
            FeatureDataResult,
            CanvasFeatureRenderingBackend
          >()
          self.attachRenderingBackend<CanvasFeatureRenderingBackend>(backend, {
            upload: b => {
              // renderDataMap === laidOutDataMap when idle; during a Y morph it
              // yields fresh per-frame region objects, so syncRegions re-uploads
              // the interpolated rows each frame (and once more on settle).
              syncRegions(b, self.renderDataMap)
            },
            render: b => {
              if (self.renderDataMap.size === 0) {
                return false
              }
              b.renderBlocks(
                self.renderBlocks,
                self.renderDataMap,
                self.renderState,
              )
              return true
            },
          })
        },

        /**
         * #action
         */
        setFeatureDensityStatsLimit(stats?: {
          bytes?: number
          fetchSizeLimit?: number
        }) {
          // Clear both gates first: force-loads alternate between byte and
          // density limits depending on which gate tripped, and leaving a
          // stale value behind disables the other code path forever (the
          // maxFeatureDensity getter short-circuits when userByteSizeLimit
          // is set, and densityTooLarge ignores its stats when no max is set).
          self.userByteSizeLimit = undefined
          self.userFeatureDensityLimit = undefined
          if (stats?.bytes) {
            // Raise the gate past the estimate scaled to the *current* view,
            // not the raw captured bytes — the gate compares against
            // estimatedVisibleBytes, so basing the limit on the same scaled
            // value keeps force-load reliable even if the view zoomed between
            // the estimate and the click (mirrors the density branch below,
            // which uses density observed at the current bpPerPx).
            const bytes = self.estimatedVisibleBytes ?? stats.bytes
            self.userByteSizeLimit = Math.ceil(bytes * 1.5)
          } else if (self.maxFeatureDensity !== undefined) {
            // Push the gate past the highest observed density across visible
            // regions, not past the current `maxFeatureDensity`. The latter
            // already includes any prior force-load, so basing on it
            // multiplied force-load attempts exponentially.
            const observedMax = self.observedMaxDensity(getView(self).bpPerPx)
            const baseline =
              observedMax > 0
                ? observedMax
                : readConfObject(self.conf, 'maxFeatureScreenDensity')
            self.userFeatureDensityLimit = Math.ceil(baseline * 1.5)
          }
          // Derived regionTooLarge recomputes once the limit changes — no
          // imperative flag to clear.
        },

        /**
         * #action
         */
        setHover(
          featureId: string | null,
          subfeatureId: string | null,
          tooltip: string | undefined,
        ) {
          self.featureIdUnderMouse = featureId
          self.subfeatureIdUnderMouse = subfeatureId
          self.mouseoverExtraInformation = tooltip
        },

        /**
         * #action
         */
        clearHover() {
          self.featureIdUnderMouse = null
          self.subfeatureIdUnderMouse = null
          self.mouseoverExtraInformation = undefined
        },

        /**
         * #action
         */
        setContextMenuFeature(feature?: Feature) {
          self.contextMenuFeature = feature
        },

        /**
         * #action
         */
        setContextMenuInfo(info?: {
          item: FlatbushItem
          displayedRegionIndex: number
        }) {
          self.contextMenuInfo = info
          if (!info) {
            self.contextMenuFeature = undefined
          }
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        selectFeature(feature: Feature) {
          openFeatureWidget(self, feature.toJSON(), {
            widget: self.featureWidgetType,
          })
        },

        /**
         * #action
         */
        clearSelection() {
          getSession(self).clearSelection()
        },

        /**
         * #action
         */
        setShowLabels(value: ShowLabelsMode) {
          self.configuration.setSlot('showLabels', value)
        },

        /**
         * #action
         */
        setAutoHeight(value: boolean) {
          self.configuration.setSlot('autoHeight', value)
          if (value) {
            // The manual expand/restore state is meaningless once auto-fit
            // drives the height; drop it so a later disable doesn't surface a
            // stale "restore previous height".
            self.clearHeightBeforeExpand()
          }
        },

        /**
         * #action
         */
        setShowDescriptions(value: boolean) {
          self.configuration.setSlot('showDescriptions', value)
        },

        /**
         * #action
         * Sets the runtime filter override (already-`jexl:`-prefixed
         * expressions). Pass undefined to clear it and fall back to the config
         * `jexlFilters` slot.
         */
        setJexlFilters(filters?: string[]) {
          self.jexlFiltersSetting = cast(filters)
        },

        /**
         * #action
         */
        setShowOutline(value: boolean) {
          // THEME_DERIVED_COLOR sentinel: the worker resolves it to a
          // theme-appropriate outline so it stays visible on dark tracks too.
          self.configuration.setSlot(
            'outlineColor',
            value ? THEME_DERIVED_COLOR : '',
          )
        },

        /**
         * #action
         */
        // undefined resets to the slot's config default (which may be a
        // per-feature jexl color); a string sets a solid color for all
        // features. Flows to the worker via rpcProps -> displayConfig.color.
        setFeatureColor(color?: string) {
          self.configuration.setSlot('color', color)
        },

        /**
         * #action
         */
        setUtrColor(color?: string) {
          self.configuration.setSlot('utrColor', color)
        },

        /**
         * #action
         */
        showContextMenuForFeature(
          featureInfo: FlatbushItem,
          displayedRegionIndex: number,
        ) {
          self.setContextMenuInfo({ item: featureInfo, displayedRegionIndex })
          self.mouseoverExtraInformation = undefined
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Opens the solid-color picker. UTR row hidden for displays without UTRs
        // (e.g. variants).
        openSetColorDialog(showUtrColor = true) {
          getSession(self).queueDialog(handleClose => [
            SetColorDialog,
            { model: self, handleClose, showUtrColor },
          ])
        },

        /**
         * #action
         */
        openColorByAttributeDialog() {
          getSession(self).queueDialog(handleClose => [
            ColorByAttributeDialog,
            {
              model: self,
              handleClose,
              initialAttribute: self.colorByAttribute,
            },
          ])
        },

        /**
         * #action
         */
        openFilterDialog() {
          getSession(self).queueDialog(handleClose => [
            AddFiltersDialog,
            { model: self, handleClose },
          ])
        },

        /**
         * #action
         */
        async fetchFullFeature(
          featureId: string,
          displayedRegionIndex: number,
        ) {
          const region = self.loadedRegions.get(displayedRegionIndex)
          if (!region) {
            return undefined
          }
          return fetchCanvasFeatureDetails(
            getSession(self),
            getRpcSessionId(self),
            self.adapterConfig,
            featureId,
            region,
          )
        },

        /**
         * #action
         */
        selectFeatureById(
          featureInfo: FlatbushItem,
          subfeatureInfo: SubfeatureInfo | undefined,
          displayedRegionIndex: number,
        ) {
          const region = self.loadedRegions.get(displayedRegionIndex)
          if (!region) {
            return
          }
          const featureIdToFetch = subfeatureInfo
            ? subfeatureInfo.parentFeatureId
            : featureInfo.featureId
          void (async () => {
            const parentFeature = await fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfig,
              featureIdToFetch,
              region,
            )
            if (parentFeature && isAlive(self)) {
              const target = subfeatureInfo
                ? (findSubfeatureById(
                    parentFeature,
                    subfeatureInfo.featureId,
                  ) ?? parentFeature)
                : parentFeature
              self.selectFeature(target)
            }
          })()
        },

        /**
         * #action
         */
        // The only bpPerPx-dependent worker decision is the amino-acid overlay
        // (gated by shouldRenderPeptideBackground). Refetch when crossing that
        // discrete threshold; otherwise the cached data stays valid.
        //
        // Missing rpcData (regionData === undefined) means the region was
        // pruned off-screen or not yet fetched — always refetch. The
        // FetchVisibleRegions autorun gates on regionTooLarge before calling
        // this, so the density-blocking case is handled there, not here.
        isCacheValid(displayedRegionIndex: number) {
          const view = getView(self)
          const regionData = self.rpcDataMap.get(displayedRegionIndex)
          if (regionData === undefined) {
            return false
          }
          return (
            shouldRenderPeptideBackground(view.bpPerPx) ===
            shouldRenderPeptideBackground(regionData.loadedBpPerPx)
          )
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        // Compressed-byte budget passed into the feature-fetch RPC, which
        // short-circuits an over-budget region before downloading features
        // (canvas gates inside the fetch RPC rather than via the shared
        // pre-flight estimate RPC, so there's no second round-trip to race).
        // Only gated in the force-load zone (visibleBp >= AUTO_FORCE_LOAD_BP);
        // below it small regions always load. `userByteSizeLimit` (set by
        // force-load) raises the budget so a forced fetch isn't re-blocked.
        byteSizeLimit(): number | undefined {
          const view = getView(self)
          return view.visibleBp < AUTO_FORCE_LOAD_BP
            ? undefined
            : (self.userByteSizeLimit ??
                readConfObject(self.conf, 'fetchSizeLimit'))
        },
      }))
      .actions(self => ({
        /**
         * #action
         */
        selectFullFeature(featureId: string, displayedRegionIndex: number) {
          void (async () => {
            const feature = await self.fetchFullFeature(
              featureId,
              displayedRegionIndex,
            )
            if (feature && isAlive(self)) {
              self.selectFeature(feature)
            }
          })()
        },
      }))
      .actions(self => {
        // One fetched region: the raw RPC response paired with the context
        // needed to commit it. `result` is too-large (density or byte
        // short-circuit) or the full feature payload — both optionally carry an
        // index `bytes` estimate.
        interface RegionFetch {
          displayedRegionIndex: number
          region: Region
          bpPerPx: number
          result: RenderFeatureDataResult
        }

        async function fetchFeaturesForRegion(
          region: Region,
          displayedRegionIndex: number,
          bpPerPx: number,
          byteSizeLimit: number | undefined,
          stopToken: StopToken,
        ): Promise<RegionFetch> {
          const sessionId = getRpcSessionId(self)
          const session = getSession(self)
          // Per-region translation table from the assembly's geneticCodes
          // config (alias-bridged via getGeneticCodeId), so the worker can
          // translate peptides on contigs whose features carry no transl_table.
          const assembly = session.assemblyManager.get(region.assemblyName)
          const result = await session.rpcManager.call(
            sessionId,
            'RenderFeatureData',
            {
              adapterConfig: self.adapterConfig,
              sequenceAdapter: self.sequenceAdapter,
              geneticCodeId: assembly?.getGeneticCodeId(region.refName),
              ...self.rpcProps(),
              region,
              bpPerPx,
              byteSizeLimit,
              stopToken,
              // keyed by region so concurrent per-region fetches aggregate
              // into one bar (FetchMixin.setRegionStatus) instead of each
              // overwriting the shared statusMessage/statusProgress
              statusCallback:
                self.makeRegionStatusCallback(displayedRegionIndex),
            },
          )
          return { displayedRegionIndex, region, bpPerPx, result }
        }

        function applyFetchResults(fetches: RegionFetch[]) {
          let totalBytes = 0
          for (const {
            displayedRegionIndex,
            region,
            bpPerPx,
            result,
          } of fetches) {
            totalBytes += result.bytes ?? 0
            // featureCount drives the density gate; absent only on a byte
            // short-circuit (no features were counted), which the byte gate
            // covers via totalBytes instead.
            if (result.featureCount !== undefined) {
              self.setDensityStats(displayedRegionIndex, {
                featureCount: result.featureCount,
                regionWidthBp: region.end - region.start,
              })
            }
            if (!('regionTooLarge' in result)) {
              self.setRpcData(displayedRegionIndex, result, bpPerPx, region)
            }
          }
          // Feed the derived byte gate (bytesEstimateTooLarge) the way the
          // pre-flight RPC used to — now sourced from the fetch itself.
          self.setFeatureDensityStats({ bytes: totalBytes })
        }

        return {
          /**
           * #action
           */
          async reload() {
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized) {
              return
            }
            self.clearAllRpcData()
            self.fetchNeeded(view.bufferedVisibleRegions)
          },

          /**
           * #action
           */
          fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            const view = getView(self)
            const bpPerPx = view.bpPerPx
            const byteSizeLimit = self.byteSizeLimit()
            // Drop cached entries (rpcDataMap + density stats) for regions no
            // longer visible. Keeps on-screen data so labels stay up during
            // the refetch window without letting either map grow unboundedly
            // as the user pans.
            self.pruneRpcDataMapToVisible(
              new Set(
                view.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
              ),
            )
            void self.fetchRegions(needed, async (ctx: FetchContext) => {
              const promises = needed.map(({ region, displayedRegionIndex }) =>
                fetchFeaturesForRegion(
                  region,
                  displayedRegionIndex,
                  bpPerPx,
                  byteSizeLimit,
                  ctx.stopToken,
                ),
              )
              const results = await Promise.all(promises)
              if (ctx.isStale()) {
                return
              }
              applyFetchResults(results)
            })
          },
        }
      })
      .actions(self => {
        const superSetFeatureDensityStats = self.setFeatureDensityStats
        return {
          /**
           * #action
           * Records the span the byte estimate was measured at so
           * `estimatedVisibleBytes` can scale it to the current view (see
           * `byteEstimateVisibleBp`).
           */
          setFeatureDensityStats(
            stats?: Parameters<typeof superSetFeatureDensityStats>[0],
          ) {
            self.byteEstimateVisibleBp = stats
              ? getView(self).visibleBp
              : undefined
            superSetFeatureDensityStats(stats)
          },
        }
      })
      .actions(self => ({
        /**
         * #action
         */
        clearStaleDensityState() {
          self.densityStatsPerRegion.clear()
          self.setFeatureDensityStats(undefined)
        },
      }))
      .actions(self => {
        const superResizeHeight = self.resizeHeight
        return {
          /**
           * #action
           * A manual drag-resize means the user wants a fixed height; turn off
           * auto-fit first, otherwise the CanvasAutoHeight autorun snaps the
           * height back on the next layout change and the drag appears to do
           * nothing.
           */
          resizeHeight(distance: number) {
            if (self.autoHeight) {
              self.setAutoHeight(false)
            }
            return superResizeHeight(distance)
          },
        }
      })
      .actions(self => {
        const superAfterAttach = self.afterAttach
        return {
          /**
           * #action
           */
          afterAttach() {
            superAfterAttach()

            // Auto-height: snap height to fit the laid-out content. maxY
            // derives from laidOutDataMap, which derives from raw fetch data +
            // coarseBpPerPx (debounced 500ms) + label visibility — so zoom
            // and label toggles both flow through here without extra plumbing.
            addDisposer(
              self,
              autorun(
                () => {
                  if (self.autoHeight) {
                    self.setHeight(self.fitHeight)
                  }
                },
                { name: 'CanvasAutoHeight' },
              ),
            )

            // Drop density-derived state when displayedRegions change
            // (chromosome navigation). Both maps are keyed by
            // displayedRegionIndex which gets reused across chromosomes —
            // stale entries would otherwise gate the derived regionTooLarge
            // banner against the wrong region's stats and block refetch.
            // densityStatsPerRegion + featureDensityStats intentionally
            // survive viewport-change clearAllRpcData calls so the banner
            // doesn't flicker; this hook is the one path that does clear
            // them, scoped to actual region-list mutation.
            onDisplayedRegionsChange(
              self,
              () => {
                self.clearStaleDensityState()
                self.clearHeightBeforeExpand()
              },
              'CanvasClearDensityOnDisplayedRegions',
            )

            // Clear hover when the viewport moves under a stationary cursor
            // (pan, zoom, internal vertical scroll). The canvas is sticky, so
            // the cursor can stay over it while content shifts underneath — no
            // mousemove/mouseleave fires, and without this the previously
            // hovered feature's tooltip stays pinned at the cursor.
            addDisposer(
              self,
              autorun(
                () => {
                  const view = getView(self)
                  void self.scrollTop
                  void view.bpPerPx
                  void view.offsetPx
                  self.clearHover()
                },
                { name: 'CanvasClearHoverOnViewportChange' },
              ),
            )

            // Drive the feature-Y transition. When laidOutDataMap re-packs at
            // the same vertical scale (a zoom step — not a label/mode change,
            // which alters row heights), animate from the previous rows to the
            // new ones; otherwise snap. Compares to the prior map kept in
            // closure so the trigger is the layout change itself.
            // Seeded lazily on the autorun's first initialized run, NOT here:
            // showLabels/effectiveShowDescriptions transitively read view.width
            // (via the density gate), which throws before the view is measured.
            // Reading them synchronously in afterAttach would throw during
            // session restore — propagating out of display instantiation and
            // making the session loader drop the display as "unhydratable".
            // These prevs are only compared once prevLayout is non-undefined,
            // which can't happen until after the first guarded run has set them.
            let prevLayout: Map<number, FeatureDataResult> | undefined
            let prevMode: string | undefined
            let prevShowLabels: boolean | undefined
            let prevShowDescriptions: boolean | undefined
            // autorunOnReadyView gates on view.initialized — laidOutDataMap is
            // empty until then, and showLabels/effectiveShowDescriptions read
            // view.width (which throws pre-measure), so the body must not run
            // until the view is ready. prevs stay undefined until the first
            // ready run seeds them; they're only compared once prevLayout is
            // non-undefined, which can't happen before that first run.
            autorunOnReadyView(
              self,
              () => {
                const current = self.laidOutDataMap
                const mode = self.displayMode
                const showLabels = self.showLabels
                const showDescriptions = self.effectiveShowDescriptions
                const scaleUnchanged =
                  mode === prevMode &&
                  showLabels === prevShowLabels &&
                  showDescriptions === prevShowDescriptions
                const from = prevLayout
                prevLayout = current
                prevMode = mode
                prevShowLabels = showLabels
                prevShowDescriptions = showDescriptions
                // Not a real layout-to-layout transition (first data, an
                // empty map on nav) — nothing to morph or snap.
                if (
                  from === undefined ||
                  from === current ||
                  from.size === 0 ||
                  current.size === 0
                ) {
                  return
                }
                const fromTops = captureFeatureTops(from)
                // Only a same-scale repack (a zoom step) has comparable rows to
                // pin against; a mode/label change rescales every row, so let it
                // snap without scroll-follow.
                if (scaleUnchanged) {
                  // scrollTop/height are viewport state, not layout inputs —
                  // read untracked so writing scrollTop back below can't
                  // re-trigger this layout autorun.
                  const { scrollTop, viewportCenterY } = untracked(() => ({
                    scrollTop: self.scrollTop,
                    viewportCenterY: self.scrollTop + self.height / 2,
                  }))
                  const scrollDelta = focusScrollDelta(
                    fromTops,
                    captureFeatureTops(current),
                    viewportCenterY,
                  )
                  if (
                    morphAllowed(getSession(self).animationMode) &&
                    canMorph(fromTops, current)
                  ) {
                    self.beginYMorph(
                      fromTops,
                      maxBottom(from),
                      scrollTop,
                      scrollDelta,
                    )
                  } else {
                    // Dense view or reduced motion: snap, but still keep the
                    // focused gene in place with an instant scroll shift.
                    self.endYMorph()
                    self.setScrollTop(scrollTop + scrollDelta)
                  }
                } else {
                  self.endYMorph()
                }
              },
              { name: 'CanvasYMorph' },
            )
          },
        }
      })
      .views(self => ({
        /**
         * #method
         */
        // Extension point for subclasses to add checkbox/radio items to the
        // "Show..." submenu without rebuilding trackMenuItems from scratch.
        showSubmenuMenuItems() {
          return [
            radioSubMenu(
              'Show labels',
              self.showLabelsMode,
              [
                { value: 'auto', label: 'Auto (hide when dense)' },
                { value: 'on', label: 'Always on' },
                { value: 'off', label: 'Always off' },
              ],
              mode => {
                self.setShowLabels(mode)
              },
            ),
            {
              label: 'Show descriptions',
              type: 'checkbox' as const,
              checked: self.showDescriptions,
              onClick: () => {
                self.setShowDescriptions(!self.showDescriptions)
              },
            },
            {
              label: 'Show outline',
              type: 'checkbox' as const,
              checked: self.showOutline,
              onClick: () => {
                self.setShowOutline(!self.showOutline)
              },
            },
            {
              label: 'Auto-fit height',
              type: 'checkbox' as const,
              checked: self.autoHeight,
              onClick: () => {
                self.setAutoHeight(!self.autoHeight)
              },
            },
          ]
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        contextMenuItems() {
          const info = self.contextMenuInfo
          if (!info) {
            return []
          }
          const {
            item: { featureId, startBp, endBp },
            displayedRegionIndex,
          } = info
          return [
            {
              label: 'Open feature details',
              icon: MenuOpenIcon,
              onClick: () => {
                self.selectFullFeature(featureId, displayedRegionIndex)
              },
            },
            {
              label: 'Zoom to feature',
              icon: CenterFocusStrongIcon,
              onClick: () => {
                const region = self.loadedRegions.get(displayedRegionIndex)
                if (region) {
                  const view = getView(self)
                  // grow 0.2 adds ~20% flanks so the feature isn't pinned to
                  // the viewport edges (matches synteny/bookmark zoom-to).
                  view.navTo(
                    {
                      refName: region.refName,
                      start: startBp,
                      end: endBp,
                    },
                    0.2,
                  )
                }
              },
            },
            {
              label: 'Copy info to clipboard',
              icon: ContentCopyIcon,
              onClick: () => {
                void (async () => {
                  const session = getSession(self)
                  const fullFeature = await self.fetchFullFeature(
                    featureId,
                    displayedRegionIndex,
                  )
                  if (!fullFeature) {
                    return
                  }
                  try {
                    const { uniqueId: _, ...rest } = fullFeature.toJSON()
                    const { default: copy } =
                      await import('@jbrowse/core/util/copyToClipboard')
                    copy(JSON.stringify(rest, null, 4))
                    session.notify('Copied to clipboard', 'success')
                  } catch (e) {
                    console.error(e)
                    session.notifyError(`${e}`, e)
                  }
                })()
              },
            },
          ]
        },

        /**
         * #method
         * The "Color by..." radio choices (solid/strand/attribute). Split out so
         * subclasses can reuse them while assembling their own color menu.
         */
        colorBySubMenuItems() {
          return [
            {
              label: 'Solid color...',
              type: 'radio' as const,
              checked: self.colorByMode === 'solid',
              onClick: () => {
                self.openSetColorDialog()
              },
            },
            {
              label: 'Strand',
              type: 'radio' as const,
              checked: self.colorByMode === 'strand',
              onClick: () => {
                self.setFeatureColor(STRAND_COLOR_JEXL)
              },
            },
            {
              label: 'Attribute...',
              type: 'radio' as const,
              checked: self.colorByMode === 'attribute',
              onClick: () => {
                self.openColorByAttributeDialog()
              },
            },
          ]
        },
      }))
      .views(self => ({
        /**
         * #method
         * Color-related track menu entries: a single "Color by..." entry whose
         * "Solid color..." choice opens the solid+UTR color picker. Subclasses
         * (e.g. variants) override to drop the gene-oriented UTR picker.
         */
        colorMenuItems() {
          return [
            {
              label: 'Color by...',
              icon: PaletteIcon,
              subMenu: self.colorBySubMenuItems(),
            },
          ]
        },
      }))
      .views(self => ({
        /**
         * #method
         */
        trackMenuItems() {
          return [
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: self.showSubmenuMenuItems(),
            },
            ...self.colorMenuItems(),
            {
              label: 'Filter by...',
              icon: ClearAllIcon,
              onClick: () => {
                self.openFilterDialog()
              },
            },
          ]
        },
      }))
  )
}
