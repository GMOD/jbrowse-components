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

import { computeLaidOutData } from './layout.ts'
import { shouldRenderPeptideBackground } from '../RenderFeatureDataRPC/zoomThresholds.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { CanvasFeatureBackend } from './components/canvasFeatureBackendTypes.ts'
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

// Shared GPU-accelerated feature display base for canvas-rendered tracks.
// Handles fetching, layout, the "Show labels" / "Show descriptions" UI, and
// the fetch-invalidation autorun. Subclasses (LinearBasicDisplay,
// LinearVariantDisplay, ...) layer their own schema-specific property,
// menu, and RPC extensions on top via the two extension hooks below
// (displayConfigOverrides / extraRpcArgs) and the showSubmenuMenuItems /
// trackMenuItems / contextMenuItems super-extension pattern.
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
      // Migrate legacy snapshot shapes: strip removed FeatureDensityMixin
      // fields, lift `height` to `heightPreConfig`, and promote the old
      // per-property `track<Setting>` values into the unified configOverrides
      // map.
      .preProcessSnapshot((snap: any) => {
        if (!snap) {
          return snap
        }
        const {
          blockState,
          showLegend,
          showTooltips,
          userBpPerPxLimit,
          userByteSizeLimit,
          height,
          trackShowLabels,
          trackShowDescriptions,
          trackSubfeatureLabels,
          trackGeneGlyphMode,
          trackDisplayMode,
          trackDisplayDirectionalChevrons,
          ...rest
        } = snap

        const migrated: Record<string, unknown> = {}
        if (trackShowLabels !== undefined) {
          migrated.showLabels = trackShowLabels
        }
        if (trackShowDescriptions !== undefined) {
          migrated.showDescriptions = trackShowDescriptions
        }
        if (trackSubfeatureLabels !== undefined) {
          migrated.subfeatureLabels = trackSubfeatureLabels
        }
        if (trackGeneGlyphMode !== undefined) {
          migrated.geneGlyphMode = trackGeneGlyphMode
        }
        if (trackDisplayMode !== undefined) {
          migrated.displayMode = trackDisplayMode
        }
        if (trackDisplayDirectionalChevrons !== undefined) {
          migrated.displayDirectionalChevrons = trackDisplayDirectionalChevrons
        }

        return {
          ...rest,
          ...(height !== undefined && rest.heightPreConfig === undefined
            ? { heightPreConfig: height }
            : undefined),
          ...(Object.keys(migrated).length > 0 && {
            configOverrides: { ...rest.configOverrides, ...migrated },
          }),
        }
      })
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
        // Laid-out data derived from the raw per-region fetch results. Mobx
        // caches this — it only recomputes when any tracked input changes (raw
        // data, bpPerPx, label visibility). Every consumer (hit test, GPU
        // upload, React render) reads this getter and sees the same cached map
        // until an input moves.
        get laidOutDataMap(): Map<number, FeatureDataResult> {
          const view = getContainingView(self) as LGV
          if (!view.initialized || self.rpcDataMap.size === 0) {
            return new Map()
          }
          return computeLaidOutData(self.rpcDataMap, {
            bpPerPx: view.coarseBpPerPx,
            regionKeys: this.regionKeys,
            showLabels: this.showLabels,
            showDescriptions: this.effectiveShowDescriptions,
            reversedRegions: this.reversedRegions,
          })
        },

        get maxY() {
          let max = 0
          for (const data of this.laidOutDataMap.values()) {
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

        get renderState() {
          const view = getContainingView(self) as LGV
          return {
            scrollY: self.scrollTop,
            canvasWidth: view.trackWidthPx,
            canvasHeight: self.height,
          }
        },

        get adapterConfigSnapshot() {
          return getConf(getContainingTrack(self), 'adapter') as Record<
            string,
            unknown
          >
        },

        get displayConfigSnapshot(): DisplayConfig {
          return {
            ...getConfSnapshot(self.configuration),
            ...(self.configOverrides as Omit<
              typeof self.configOverrides,
              symbol
            >),
          } as DisplayConfig
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
          if (isAlive(self)) {
            const { selection } = getSession(self)
            if (isFeature(selection)) {
              return selection.id()
            }
          }
          return undefined
        },

        get featureIdIndex() {
          const map = new Map<string, FlatbushItem>()
          for (const data of this.laidOutDataMap.values()) {
            for (const f of data.flatbushItems) {
              if (!map.has(f.featureId)) {
                map.set(f.featureId, f)
              }
            }
          }
          return map
        },

        get subfeatureIdIndex() {
          const map = new Map<string, SubfeatureInfo>()
          for (const data of this.laidOutDataMap.values()) {
            for (const s of data.subfeatureInfos) {
              if (!map.has(s.featureId)) {
                map.set(s.featureId, s)
              }
            }
          }
          return map
        },

        get hoveredFeature() {
          const id = self.featureIdUnderMouse
          if (id) {
            return this.featureIdIndex.get(id) ?? null
          }
          return null
        },

        get hoveredSubfeature() {
          const id = self.subfeatureIdUnderMouse
          if (id) {
            return this.subfeatureIdIndex.get(id) ?? null
          }
          return null
        },

        get maxFeatureDensity() {
          // Skip density gating when the user has already force-loaded via byte estimate
          if (self.userByteSizeLimit !== undefined) {
            console.warn(
              `[canvas maxFeatureDensity] skipped: userByteSizeLimit=${self.userByteSizeLimit}`,
            )
            return undefined
          }
          const view = getContainingView(self) as LGV
          if (view.visibleBp < AUTO_FORCE_LOAD_BP) {
            console.warn(
              `[canvas maxFeatureDensity] skipped: visibleBp=${view.visibleBp} < AUTO_FORCE_LOAD_BP=${AUTO_FORCE_LOAD_BP}`,
            )
            return undefined
          }
          const result =
            self.userFeatureDensityLimit ??
            self.getConfWithOverride<number>('maxFeatureScreenDensity')
          console.warn(
            `[canvas maxFeatureDensity] visibleBp=${view.visibleBp} ` +
              `userFeatureDensityLimit=${self.userFeatureDensityLimit} ` +
              `configValue=${self.getConfWithOverride<number>('maxFeatureScreenDensity')} ` +
              `result=${result}`,
          )
          return result
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

        get featureWidgetType() {
          return {
            type: 'BaseFeatureWidget',
            id: 'baseFeature',
          }
        },

        // Subclasses override to inject additional fields into the
        // `displayConfig` payload sent to the RenderFeatureData RPC (e.g.
        // effectiveGeneGlyphMode resolving 'auto').
        get displayConfigOverrides(): Record<string, unknown> {
          return {}
        },

        // Subclasses override to inject additional top-level args into the
        // RenderFeatureData RPC call (e.g. showOnlyGenes).
        get extraRpcArgs(): Record<string, unknown> {
          return {}
        },
      }))
      .views(self => ({
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
        },
      }))
      .views(self => ({
        // The full payload sent to the RenderFeatureData RPC. Adding a
        // field here propagates both into the RPC call (via
        // fetchFeaturesForRegion) and into the SettingsInvalidate autorun
        // (which reads this getter), so refetch happens automatically when
        // any field changes — no separate cache key to maintain.
        get rpcProps() {
          return {
            adapterConfig: self.adapterConfigSnapshot,
            displayConfig: {
              ...self.displayConfigSnapshot,
              ...self.displayConfigOverrides,
            },
            maxFeatureDensity: self.maxFeatureDensity,
            colorByCDS: self.colorByCDS,
            sequenceAdapter: self.sequenceAdapter,
            ...self.extraRpcArgs,
          }
        },
      }))
      // Derived regionTooLarge: a pure function of cached stats × current
      // bpPerPx + visible regions. No imperative clear-and-reset, so small
      // zoom/pan moves don't flicker the banner. Shadows RegionTooLargeMixin's
      // imperative getter and the earlier laidOutDataMap.
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
            if (
              ds &&
              (ds.featureCount / ds.regionWidthBp) * view.bpPerPx > max
            ) {
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
      // Empty layout when too-large so the GPU upload autorun has nothing
      // to push — banner UI hides the canvas, this prevents any stale flash.
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
                console.warn('[canvas render] laidOutDataMap empty, skip draw')
                return false
              }
              console.warn(
                '[canvas render] drawing, laidOutDataMap.size=',
                self.laidOutDataMap.size,
              )
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
            self.userFeatureDensityLimit = Math.ceil(self.maxFeatureDensity * 3)
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
            self.adapterConfigSnapshot,
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
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            const parentFeature = await fetchCanvasFeatureDetails(
              getSession(self),
              getRpcSessionId(self),
              self.adapterConfigSnapshot,
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

        // Worker output positions and heights are genomic and config-driven
        // (no continuous bpPerPx dependence). The only `bpPerPx`-driven
        // worker decision that affects output is whether the amino-acid
        // overlay was fetched (gated by `shouldRenderPeptideBackground`).
        // Refetch only when crossing that discrete threshold — never on
        // continuous zoom drift.
        //
        // For too-large regions (loadedRegions set, but no rpcData because
        // the worker bailed on density), treat the cache as valid while the
        // density × bpPerPx still trips the threshold; refetch when it no
        // longer does so the banner can clear.
        isCacheValid(displayedRegionIndex: number) {
          const view = getContainingView(self) as LGV
          const regionData = self.rpcDataMap.get(displayedRegionIndex)
          if (regionData === undefined) {
            const ds = self.densityStatsPerRegion.get(displayedRegionIndex)
            if (!ds) {
              return true
            }
            const max = self.maxFeatureDensity
            if (max === undefined) {
              return false
            }
            return (ds.featureCount / ds.regionWidthBp) * view.bpPerPx > max
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
            adapterConfig: self.adapterConfigSnapshot,
            fetchSizeLimit: 1_000_000,
            userByteSizeLimit: self.userByteSizeLimit,
            visibleBp: view.visibleBp,
          }
        },
      }))
      .actions(self => ({
        selectFullFeature(featureId: string, displayedRegionIndex: number) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
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
              ...self.rpcProps,
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
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            self.fetchRegions(needed, async (ctx: FetchContext) => {
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
            // bpPerPx + label visibility — so zoom and label toggles both
            // flow through here without any extra plumbing.
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
          const region = self.loadedRegions.get(displayedRegionIndex)
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
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                ;(async () => {
                  if (!region) {
                    return
                  }
                  const session = getSession(self)
                  const fullFeature = await fetchCanvasFeatureDetails(
                    session,
                    getRpcSessionId(self),
                    self.adapterConfigSnapshot,
                    featureId,
                    region,
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
