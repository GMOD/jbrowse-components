import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  getConfSnapshot,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
  isFeature,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
  getDisplayStr,
} from '@jbrowse/plugin-linear-genome-view'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, observable } from 'mobx'

import {
  buildFeatureFlatbushIndex,
  buildSubfeatureFlatbushIndex,
} from './components/hitTesting.ts'
import { computeLaidOutData } from './layout.ts'
import { migrateBasicSnapshot } from './migrateBasicSnapshot.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasFeatureBackend } from './components/canvasFeatureBackendTypes.ts'
import type { FlatbushRegionIndexes } from './components/hitTesting.ts'
// rpcTypes.ts also declares the RpcRegistry augmentation; importing any type
// from it is enough to make rpcManager.call() resolve to the typed args.
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type {
  ByteEstimateConfig,
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

type LoadedFeatureData = FeatureDataResult & { loadedBpPerPx: number }

function findSubfeatureById(
  feature: Feature,
  targetId: string,
): Feature | undefined {
  const subfeatures = feature.get('subfeatures')
  if (subfeatures) {
    for (const sub of subfeatures) {
      if (sub.id() === targetId) {
        return sub
      }
      const found = findSubfeatureById(sub, targetId)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export type { Region } from '@jbrowse/core/util'

async function fetchCanvasFeatureDetails(
  session: {
    rpcManager: RpcManager
    notifyError: (msg: string, err?: unknown) => void
  },
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  featureId: string,
  region: Region,
) {
  try {
    const result = await session.rpcManager.call(
      sessionId,
      'GetCanvasFeatureDetails',
      { sessionId, adapterConfig, featureId, region },
    )
    return result.feature ? new SimpleFeature(result.feature) : undefined
  } catch (e) {
    console.error('Failed to fetch feature details:', e)
    session.notifyError(`${e}`, e)
    return undefined
  }
}

const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))

const DESCRIPTION_DENSITY_THRESHOLD = 0.2

// Features-per-pixel for a single region given its raw count, the region's
// genomic span, and the current bpPerPx. Used by the derived regionTooLarge
// banner and by force-load to sample observed density.
function screenDensity(
  ds: { featureCount: number; regionWidthBp: number },
  bpPerPx: number,
) {
  return (ds.featureCount / ds.regionWidthBp) * bpPerPx
}

// First-wins index from per-region arrays. Spanning features can appear in
// multiple regions; we keep the first occurrence so consumers (hover lookup,
// selection, label resolution) get a single, stable item per featureId.
function indexById<T extends { featureId: string }>(
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>,
  pick: (data: FeatureDataResult) => readonly T[],
) {
  const map = new Map<string, T>()
  for (const data of laidOutDataMap.values()) {
    for (const item of pick(data)) {
      if (!map.has(item.featureId)) {
        map.set(item.featureId, item)
      }
    }
  }
  return map
}

// Shared GPU-accelerated feature display base for canvas-rendered tracks.
// Handles fetching, layout, the "Show labels" / "Show descriptions" UI, and
// the fetch-invalidation autorun. Subclasses layer schema-specific properties
// and menus via the showSubmenuMenuItems / trackMenuItems / contextMenuItems
// super-extension pattern, and extend rpcProps() via the standard
// super-capture pattern.
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
        ConfigOverrideMixin(),
        types.model({
          configuration: ConfigurationReference(configSchema),
        }),
      )
      .preProcessSnapshot(
        // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
        // return type against the model creation type
        (snap: Record<string, unknown> | undefined) =>
          migrateBasicSnapshot(snap),
      )
      .volatile(() => ({
        rpcDataMap: observable.map<number, LoadedFeatureData>(),
        // Per-region density stats (featureCount over genomic span) populated
        // for both successful fetches and worker-side too-large responses.
        // Drives the derived `regionTooLarge` getter so banner state is a
        // pure function of cached data + current bpPerPx (no flicker on
        // small zoom changes).
        densityStatsPerRegion: observable.map<
          number,
          { featureCount: number; regionWidthBp: number }
        >(),
        featureIdUnderMouse: null as string | null,
        subfeatureIdUnderMouse: null as string | null,
        mouseoverExtraInformation: undefined as string | undefined,
        contextMenuFeature: undefined as Feature | undefined,
        contextMenuInfo: undefined as
          | { item: FlatbushItem; displayedRegionIndex: number }
          | undefined,
        userFeatureDensityLimit: undefined as number | undefined,
        featureDensityPerPx: 0,
        heightBeforeExpand: undefined as number | undefined,
      }))
      .views(self => ({
        get renderState() {
          const view = getContainingView(self) as LGV
          return {
            scrollY: self.scrollTop,
            canvasWidth: view.trackWidthPx,
            canvasHeight: self.height,
          }
        },

        get DisplayMessageComponent() {
          return FeatureComponent
        },

        get showTooltipsEnabled() {
          return false
        },

        get showLegend() {
          return false
        },

        get maxHeight() {
          return self.getConfWithOverride<number>('maxHeight')
        },

        get autoHeight() {
          return self.getConfWithOverride<boolean>('autoHeight')
        },

        get showLabels() {
          return self.getConfWithOverride<boolean>('showLabels')
        },

        get showDescriptions() {
          return self.getConfWithOverride<boolean>('showDescriptions')
        },

        get showOutline() {
          return !!self.getConfWithOverride<string>('outline')
        },

        get effectiveShowDescriptions() {
          return (
            this.showDescriptions &&
            self.featureDensityPerPx < DESCRIPTION_DENSITY_THRESHOLD
          )
        },

        get selectedFeatureId() {
          const selection = isAlive(self)
            ? getSession(self).selection
            : undefined
          return isFeature(selection) ? selection.id() : undefined
        },

        get maxFeatureDensity() {
          // Skip density gating when the user has already force-loaded via byte estimate
          if (self.userByteSizeLimit !== undefined) {
            return undefined
          }
          const view = getContainingView(self) as LGV
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return undefined
          }
          return (
            self.userFeatureDensityLimit ??
            self.getConfWithOverride<number>('maxFeatureScreenDensity')
          )
        },

        get colorByCDS() {
          const view = getContainingView(self) as LGV
          return view.colorByCDS
        },

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

        get regionKeys() {
          const map = new Map<number, string>()
          for (const [num, region] of self.loadedRegions) {
            map.set(num, `${region.assemblyName}:${region.refName}`)
          }
          return map
        },

        get reversedRegions() {
          const set = new Set<number>()
          for (const [num, region] of self.loadedRegions) {
            if (region.reversed) {
              set.add(num)
            }
          }
          return set
        },

        get featureWidgetType() {
          return {
            type: 'BaseFeatureWidget',
            id: 'baseFeature',
          }
        },
      }))
      .views(self => ({
        // User-controlled settings sent to the worker via RPC. Every field
        // read here becomes a cache key: SettingsInvalidate autorun calls
        // rpcProps() and clears data when any field changes. Structural args
        // (adapterConfig, sequenceAdapter, region, bpPerPx) are added at the
        // RPC call site, matching the pattern used by every other display
        // type. Subclasses extend via the super-capture pattern.
        rpcProps() {
          return {
            displayConfig: {
              ...getConfSnapshot(self.configuration),
              ...self.configOverrides,
            } as DisplayConfig,
            maxFeatureDensity: self.maxFeatureDensity,
            colorByCDS: self.colorByCDS,
          }
        },
      }))
      // Derived regionTooLarge: a pure function of cached stats × current
      // bpPerPx + visible regions. No imperative clear-and-reset, so small
      // zoom/pan moves don't flicker the banner. Shadows RegionTooLargeMixin's
      // imperative getter.
      .views(self => ({
        get bytesEstimateTooLarge() {
          const view = getContainingView(self) as LGV
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
            (getConf(self, 'fetchSizeLimit') as number)
          return stats.bytes > limit
        },

        get densityTooLarge() {
          const max = self.maxFeatureDensity
          if (max === undefined) {
            return false
          }
          const view = getContainingView(self) as LGV
          for (const r of view.visibleRegions) {
            const ds = self.densityStatsPerRegion.get(r.displayedRegionIndex)
            if (ds && screenDensity(ds, view.bpPerPx) > max) {
              return true
            }
          }
          return false
        },
      }))
      .views(self => ({
        get regionTooLarge() {
          return self.bytesEstimateTooLarge || self.densityTooLarge
        },

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
        get laidOutDataMap(): Map<number, FeatureDataResult> {
          if (self.regionTooLarge) {
            return new Map()
          }
          const view = getContainingView(self) as LGV
          if (!view.initialized || self.rpcDataMap.size === 0) {
            return new Map()
          }
          return computeLaidOutData(self.rpcDataMap, {
            bpPerPx: view.coarseBpPerPx,
            regionKeys: self.regionKeys,
            showLabels: self.showLabels,
            showDescriptions: self.effectiveShowDescriptions,
            reversedRegions: self.reversedRegions,
          })
        },
      }))
      .views(self => ({
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

        get hasOverflow() {
          return this.maxY > self.height
        },

        get featureIdIndex() {
          return indexById(self.laidOutDataMap, d => d.flatbushItems)
        },

        get subfeatureIdIndex() {
          return indexById(self.laidOutDataMap, d => d.subfeatureInfos)
        },

        get hoveredFeature() {
          const id = self.featureIdUnderMouse
          return id ? (this.featureIdIndex.get(id) ?? null) : null
        },

        get hoveredSubfeature() {
          const id = self.subfeatureIdUnderMouse
          return id ? (this.subfeatureIdIndex.get(id) ?? null) : null
        },

        getFeatureById(featureId: string) {
          return this.featureIdIndex.get(featureId)
        },

        searchFeatureByID(id: string) {
          const item = this.getFeatureById(id)
          if (!item) {
            return undefined
          }
          return [item.startBp, item.topPx, item.endBp, item.bottomPx] as const
        },
      }))
      .views(self => ({
        // Flatbush spatial indexes per region for hit testing. Recomputes when
        // any input observable moves (laid-out data, label visibility, zoom,
        // reversed flag); MobX caches the value so repeated hover events read
        // the same indexes for free.
        get flatbushIndexes() {
          const view = getContainingView(self) as LGV
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
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .actions(self => ({
        expandToFit() {
          self.heightBeforeExpand = self.height
          self.setHeight(Math.min(self.maxY, self.maxHeight))
        },

        collapseFromExpand() {
          if (self.heightBeforeExpand !== undefined) {
            self.setHeight(self.heightBeforeExpand)
            self.heightBeforeExpand = undefined
          }
        },

        setRpcData(
          displayedRegionIndex: number,
          data: FeatureDataResult,
          loadedBpPerPx: number,
        ) {
          self.rpcDataMap.set(displayedRegionIndex, { ...data, loadedBpPerPx })
        },

        setDensityStats(
          displayedRegionIndex: number,
          stats: { featureCount: number; regionWidthBp: number },
        ) {
          self.densityStatsPerRegion.set(displayedRegionIndex, stats)
        },

        setFeatureDensityPerPx(value: number) {
          self.featureDensityPerPx = value
        },

        clearDisplaySpecificData() {
          // Density stats survive viewport-change clearAllRpcData calls so
          // the derived `regionTooLarge` banner stays stable across small
          // zoom or pan moves. pruneRpcDataMapToVisible drops off-screen
          // entries during fetchNeeded. rpcDataMap is similarly preserved;
          // when regionTooLarge is true, laidOutDataMap returns empty so no
          // stale features render through the banner.
          self.setScrollTop(0)
        },

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

        startGpuBackendLifecycle(backend: CanvasFeatureBackend) {
          self.installGpuDisplay<CanvasFeatureBackend>(backend, {
            upload: b => {
              const active: number[] = []
              for (const [displayedRegionIndex, data] of self.laidOutDataMap) {
                b.uploadRegion(displayedRegionIndex, data)
                active.push(displayedRegionIndex)
              }
              b.pruneRegions(active)
            },
            render: b => {
              if (self.laidOutDataMap.size === 0) {
                return false
              }
              b.renderBlocks(self.renderBlocks, self.renderState)
              return true
            },
          })
        },

        setFeatureDensityStatsLimit(stats?: {
          bytes?: number
          fetchSizeLimit?: number
        }) {
          if (stats?.bytes) {
            self.userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
          } else if (self.maxFeatureDensity !== undefined) {
            // Push the gate past the highest observed density across visible
            // regions, not past the current `maxFeatureDensity`. The latter
            // already includes any prior force-load, so basing on it
            // multiplied force-load attempts exponentially.
            const view = getContainingView(self) as LGV
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
                : (getConf(self, 'maxFeatureScreenDensity') as number)
            self.userFeatureDensityLimit = Math.ceil(baseline * 1.5)
          }
          // Derived regionTooLarge recomputes once the limit changes — no
          // imperative flag to clear.
        },

        setFeatureIdUnderMouse(featureId: string | null) {
          self.featureIdUnderMouse = featureId
        },

        setSubfeatureIdUnderMouse(featureId: string | null) {
          self.subfeatureIdUnderMouse = featureId
        },

        clearHover() {
          self.featureIdUnderMouse = null
          self.subfeatureIdUnderMouse = null
          self.mouseoverExtraInformation = undefined
        },

        setMouseoverExtraInformation(info: string | undefined) {
          self.mouseoverExtraInformation = info
        },

        setContextMenuFeature(feature?: Feature) {
          self.contextMenuFeature = feature
        },

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
        selectFeature(feature: Feature) {
          const session = getSession(self)
          session.setSelection(feature)
          if (isSessionModelWithWidgets(session)) {
            const { type, id } = self.featureWidgetType
            session.showWidget(
              session.addWidget(type, id, {
                featureData: feature.toJSON(),
                view: getContainingView(self),
                track: getContainingTrack(self),
              }),
            )
          }
        },

        clearSelection() {
          getSession(self).clearSelection()
        },

        setShowLabels(value: boolean) {
          self.setOverride('showLabels', value)
        },

        setShowDescriptions(value: boolean) {
          self.setOverride('showDescriptions', value)
        },

        setShowOutline(value: boolean) {
          self.setOverride('outline', value ? 'rgba(0,0,0,0.3)' : '')
        },

        showContextMenuForFeature(
          featureInfo: FlatbushItem,
          displayedRegionIndex: number,
        ) {
          self.setContextMenuInfo({ item: featureInfo, displayedRegionIndex })
        },
      }))
      .actions(self => ({
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

        // The only bpPerPx-dependent worker decision is the amino-acid overlay
        // (gated by shouldRenderPeptideBackground). Refetch when crossing that
        // discrete threshold; otherwise the cached data stays valid.
        //
        // Missing rpcData (regionData === undefined) means the region was
        // pruned off-screen or not yet fetched — always refetch. The
        // FetchVisibleRegions autorun gates on regionTooLarge before calling
        // this, so the density-blocking case is handled there, not here.
        isCacheValid(displayedRegionIndex: number) {
          const view = getContainingView(self) as LGV
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
        getByteEstimateConfig(): ByteEstimateConfig | null {
          const view = getContainingView(self) as LGV
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            return null
          }
          return {
            adapterConfig: self.adapterConfig,
            fetchSizeLimit: 1_000_000,
            userByteSizeLimit: self.userByteSizeLimit,
            visibleBp: view.visibleBp,
          }
        },
      }))
      .actions(self => ({
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
          let totalFeatures = 0
          let totalSpanPx = 0
          for (const r of results) {
            const regionWidthBp = r.region.end - r.region.start
            if (r.kind === 'ok') {
              self.setRpcData(r.displayedRegionIndex, r.data, r.bpPerPx)
              self.setDensityStats(r.displayedRegionIndex, {
                featureCount: r.data.featureCount,
                regionWidthBp,
              })
              totalFeatures += r.data.featureCount
              totalSpanPx += regionWidthBp / r.bpPerPx
            } else {
              self.setDensityStats(r.displayedRegionIndex, {
                featureCount: r.featureCount,
                regionWidthBp,
              })
            }
          }
          self.setFeatureDensityPerPx(
            totalSpanPx > 0 ? totalFeatures / totalSpanPx : 0,
          )
        }

        return {
          async reload() {
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized) {
              return
            }
            self.clearAllRpcData()
            self.fetchNeeded(view.bufferedVisibleRegions)
          },

          fetchNeeded(
            needed: { region: Region; displayedRegionIndex: number }[],
          ) {
            const view = getContainingView(self) as LGV
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
        clearStaleDensityState() {
          self.densityStatsPerRegion.clear()
          self.setFeatureDensityStats(undefined)
        },
      }))
      .actions(self => {
        const superAfterAttach = self.afterAttach
        return {
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
            addDisposer(
              self,
              autorun(
                () => {
                  const view = getContainingView(self) as LGV
                  void view.displayedRegions
                  self.clearStaleDensityState()
                },
                { name: 'CanvasClearDensityOnDisplayedRegions' },
              ),
            )
          },
        }
      })
      .views(self => ({
        // Extension point for subclasses to add checkbox/radio items to the
        // "Show..." submenu without rebuilding trackMenuItems from scratch.
        showSubmenuMenuItems() {
          return [
            {
              label: 'Show labels',
              type: 'checkbox' as const,
              checked: self.showLabels,
              onClick: () => {
                self.setShowLabels(!self.showLabels)
              },
            },
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
          ]
        },
      }))
      .views(self => ({
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
                  const view = getContainingView(self) as LGV
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
                    const { default: copy } = await import('copy-to-clipboard')
                    await copy(JSON.stringify(rest, null, 4))
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

        trackMenuItems() {
          return [
            {
              label: 'Show...',
              icon: VisibilityIcon,
              subMenu: self.showSubmenuMenuItems(),
            },
          ]
        },
      }))
  )
}
