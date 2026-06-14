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
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  getDisplayStr,
  onDisplayedRegionsChange,
} from '@jbrowse/plugin-linear-genome-view'
import { createRegionUploadSync } from '@jbrowse/render-core/regionUploadSync'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, observable } from 'mobx'

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
import { migrateBasicSnapshot } from './migrateBasicSnapshot.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { RegionDensityStats } from './baseModelHelpers.ts'
import type {
  DisplayConfig,
  DisplayMode,
} from '../RenderFeatureDataRPC/renderConfig.ts'
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
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ByteEstimateConfig,
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

export type { Region } from '@jbrowse/core/util'

const ColorByAttributeDialog = lazy(
  () => import('./components/ColorByAttributeDialog.tsx'),
)
const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

const STRAND_COLOR_JEXL =
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"

// rgba string used when outline is toggled on via the menu; schema stores the
// raw color so users can still set their own via setOverride('outlineColor', …).
const OUTLINE_DEFAULT_RGBA = 'rgba(0,0,0,0.3)'

// Schema defaults for the picker swatch when no override is set. Kept in sync
// with baseConfigSchema.ts color/utrColor defaults.
const FEATURE_COLOR_DEFAULT = 'goldenrod'
const UTR_COLOR_DEFAULT = '#357089'

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
        ConfigOverrideMixin<LinearBasicDisplayConfigModel>([
          'maxHeight',
          'autoHeight',
          'displayMode',
          'showLabels',
          'maxLabelFeatureDensity',
          'showDescriptions',
          'outlineColor',
          'maxFeatureScreenDensity',
          'color',
          'utrColor',
          'connectorColor',
          'subfeatureLabels',
          'geneGlyphMode',
          'displayDirectionalChevrons',
        ]),
        types.model({
          /**
           * #property
           */
          configuration: ConfigurationReference(configSchema),
        }),
      )
      .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
        migrateBasicSnapshot(snap),
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
          | { item: FlatbushItem; displayedRegionIndex: number }
          | undefined,
        /**
         * #volatile
         */
        userFeatureDensityLimit: undefined as number | undefined,
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
      }))
      .views(self => ({
        /**
         * #getter
         * the config typed off the concrete schema; `ConfigurationReference`
         * erases `self.configuration` to `any`, so direct reads route through
         * this to stay typed (same move as `BaseAdapter<CONF>`). The
         * override-aware reads use `getConfWithOverride` instead.
         */
        get conf(): LinearBasicDisplayConfigModel {
          return self.configuration
        },
      }))
      .views(self => ({
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
          const view = getView(self)
          return Math.max(
            0,
            ...view.visibleRegions.map(r => {
              const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
              return ds ? screenDensity(ds, view.coarseBpPerPx) : 0
            }),
          )
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
          return self.getConfWithOverride('maxHeight')
        },

        /**
         * #getter
         */
        get autoHeight() {
          return self.getConfWithOverride('autoHeight')
        },

        /**
         * #getter
         */
        get displayMode() {
          return self.getConfWithOverride('displayMode') as DisplayMode
        },

        /**
         * #getter
         */
        get showLabelsMode() {
          return self.getConfWithOverride('showLabels') as ShowLabelsMode
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
            self.getConfWithOverride('maxLabelFeatureDensity')
          )
        },

        /**
         * #getter
         */
        get showDescriptions() {
          return self.getConfWithOverride('showDescriptions')
        },

        /**
         * #getter
         */
        get showOutline() {
          return !!self.getConfWithOverride('outlineColor')
        },

        /**
         * #getter
         */
        // Solid color for the picker swatch. Falls back to the schema default
        // when no override is set or when the override is a jexl expression
        // (per-feature coloring) — jexl strings aren't valid CSS colors.
        get featureColor() {
          const override = self.getOverride<string>('color')
          return override !== undefined && !override.startsWith('jexl:')
            ? override
            : FEATURE_COLOR_DEFAULT
        },

        /**
         * #getter
         */
        get utrColor() {
          return self.getOverride<string>('utrColor') ?? UTR_COLOR_DEFAULT
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
            self.getConfWithOverride('maxFeatureScreenDensity')
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
          } = {
            ...getConfSnapshot(self.configuration),
            ...self.configOverrides,
          }
          return {
            displayConfig: { ...rest } as DisplayConfig,
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
         */
        get bytesEstimateTooLarge() {
          const view = getView(self)
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return false
          }
          const stats = self.featureDensityStats
          if (!stats?.bytes) {
            return false
          }
          const limit =
            self.userByteSizeLimit ??
            stats.fetchSizeLimit ??
            readConfObject(self.conf, 'fetchSizeLimit')
          return stats.bytes > limit
        },

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
        /**
         * #getter
         */
        get regionTooLarge() {
          return self.bytesEstimateTooLarge || self.densityTooLarge
        },

        /**
         * #getter
         */
        get regionTooLargeReason() {
          if (self.bytesEstimateTooLarge) {
            const bytes = self.featureDensityStats?.bytes ?? 0
            return `Requested too much data (${getDisplayStr(bytes)})`
          }
          return self.densityTooLarge ? 'Too many features' : ''
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
        get maxY() {
          let max = 0
          for (const data of self.laidOutDataMap.values()) {
            for (const item of data.flatbushItems) {
              if (item.bottomPx > max) {
                max = item.bottomPx
              }
            }
          }
          return max
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
            showSubfeatureLabels: self.displayMode !== 'collapse',
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
          self.setHeight(Math.min(self.maxY, self.maxHeight))
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
              syncRegions(b, self.laidOutDataMap)
            },
            render: b => {
              if (self.laidOutDataMap.size === 0) {
                return false
              }
              b.renderBlocks(
                self.renderBlocks,
                self.laidOutDataMap,
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
            self.userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
          } else if (self.maxFeatureDensity !== undefined) {
            // Push the gate past the highest observed density across visible
            // regions, not past the current `maxFeatureDensity`. The latter
            // already includes any prior force-load, so basing on it
            // multiplied force-load attempts exponentially.
            const view = getView(self)
            let observedMax = 0
            for (const r of view.visibleRegions) {
              const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
              if (ds) {
                const d = screenDensity(ds, view.bpPerPx)
                if (d > observedMax) {
                  observedMax = d
                }
              }
            }
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
          self.setOverride('showLabels', value)
        },

        /**
         * #action
         */
        setAutoHeight(value: boolean) {
          self.setOverride('autoHeight', value)
        },

        /**
         * #action
         */
        setShowDescriptions(value: boolean) {
          self.setOverride('showDescriptions', value)
        },

        /**
         * #action
         */
        setShowOutline(value: boolean) {
          self.setOverride('outlineColor', value ? OUTLINE_DEFAULT_RGBA : '')
        },

        /**
         * #action
         */
        // undefined clears the override (restores the config default, which may
        // be a per-feature jexl color); a string sets a solid color for all
        // features. Flows to the worker via rpcProps -> displayConfig.color.
        setFeatureColor(color?: string) {
          if (color === undefined) {
            self.clearOverride('color')
          } else {
            self.setOverride('color', color)
          }
        },

        /**
         * #action
         */
        setUtrColor(color?: string) {
          if (color === undefined) {
            self.clearOverride('utrColor')
          } else {
            self.setOverride('utrColor', color)
          }
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
        getByteEstimateConfig(): ByteEstimateConfig | null {
          const view = getView(self)
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return null
          }
          return {
            adapterConfig: self.adapterConfig,
            fetchSizeLimit: readConfObject(self.conf, 'fetchSizeLimit'),
            userByteSizeLimit: self.userByteSizeLimit,
            visibleBp: view.visibleBp,
          }
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
        interface FetchResult {
          kind: 'ok'
          displayedRegionIndex: number
          data: FeatureDataResult
          region: Region
          bpPerPx: number
        }

        interface TooLargeResult {
          kind: 'tooLarge'
          displayedRegionIndex: number
          region: Region
          featureCount: number
        }

        async function fetchFeaturesForRegion(
          region: Region,
          displayedRegionIndex: number,
          bpPerPx: number,
          stopToken: StopToken,
        ): Promise<FetchResult | TooLargeResult> {
          const sessionId = getRpcSessionId(self)
          const result = await getSession(self).rpcManager.call(
            sessionId,
            'RenderFeatureData',
            {
              sessionId,
              adapterConfig: self.adapterConfig,
              sequenceAdapter: self.sequenceAdapter,
              ...self.rpcProps(),
              region,
              bpPerPx,
              stopToken,
              statusCallback: (msg: string) => {
                if (isAlive(self)) {
                  self.setStatusMessage(msg)
                }
              },
            },
          )
          if ('regionTooLarge' in result) {
            return {
              kind: 'tooLarge',
              displayedRegionIndex,
              region,
              featureCount: result.featureCount,
            }
          }
          return {
            kind: 'ok',
            displayedRegionIndex,
            data: result,
            region,
            bpPerPx,
          }
        }

        function applyFetchResults(results: (FetchResult | TooLargeResult)[]) {
          for (const r of results) {
            const regionWidthBp = r.region.end - r.region.start
            if (r.kind === 'ok') {
              self.setRpcData(
                r.displayedRegionIndex,
                r.data,
                r.bpPerPx,
                r.region,
              )
              self.setDensityStats(r.displayedRegionIndex, {
                featureCount: r.data.featureCount,
                regionWidthBp,
              })
            } else {
              self.setDensityStats(r.displayedRegionIndex, {
                featureCount: r.featureCount,
                regionWidthBp,
              })
            }
          }
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
                  if (!self.autoHeight) {
                    return
                  }
                  const target = Math.min(
                    Math.max(self.maxY, 50),
                    self.maxHeight,
                  )
                  self.setHeight(target)
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
                  view.navTo({
                    refName: region.refName,
                    start: startBp,
                    end: endBp,
                  })
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
         */
        trackMenuItems() {
          return [
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: self.showSubmenuMenuItems(),
            },
            {
              label: 'Color',
              icon: PaletteIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetColorDialog,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'Color by...',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Default (solid color)',
                  onClick: () => {
                    self.setFeatureColor(undefined)
                  },
                },
                {
                  label: 'Strand',
                  onClick: () => {
                    self.setFeatureColor(STRAND_COLOR_JEXL)
                  },
                },
                {
                  label: 'Attribute...',
                  onClick: () => {
                    getSession(self).queueDialog(handleClose => [
                      ColorByAttributeDialog,
                      { model: self, handleClose },
                    ])
                  },
                },
              ],
            },
          ]
        },
      }))
  )
}
