import { lazy } from 'react'

import {
  ConfigurationReference,
  getConfSnapshot,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun, observable } from 'mobx'

import { computeLaneLaidOutData } from './layout.ts'

import type { CanvasFeatureBackend } from '../LinearBasicDisplay/components/canvasFeatureBackendTypes.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  MultiBedDisplayConfig,
  MultiBedRenderResult,
} from '../RenderMultiBedDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type {
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel
type LoadedFeatureData = MultiBedRenderResult & { loadedBpPerPx: number }

interface SourceInfo {
  name: string
  color?: string
}

const FeatureComponent = lazy(
  () => import('../LinearBasicDisplay/components/FeatureComponent.tsx'),
)

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

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearBasicDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      ConfigOverrideMixin(),
      types.model({
        type: types.literal('MultiLinearBasicDisplay'),
        configuration: ConfigurationReference(configSchema),
        // Ordered lane keys; persisted in the snapshot so per-sample row
        // ordering survives reload. Empty → use sourcesVolatile order.
        layout: types.array(types.frozen<SourceInfo>()),
      }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, LoadedFeatureData>(),
      sourcesVolatile: [] as SourceInfo[],
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

      get laneHeight() {
        return self.getConfWithOverride<number>('laneHeight')
      },

      get laneGap() {
        return self.getConfWithOverride<number>('laneGap')
      },

      get laneField() {
        return self.getConfWithOverride<string>('laneField')
      },

      // Lane ordering: explicit `layout` array (drag-reorderable in future)
      // wins; otherwise fall back to discovery order in `sourcesVolatile`.
      get sources(): SourceInfo[] {
        const sourceMap = new Map(self.sourcesVolatile.map(s => [s.name, s]))
        const iter = self.layout.length
          ? (self.layout as SourceInfo[])
          : self.sourcesVolatile
        return iter.map(s => ({
          ...sourceMap.get(s.name),
          ...s,
        }))
      },

      // showLabels/showDescriptions exist so FeatureComponent's structural
      // model contract is satisfied; not actually meaningful for one-line lanes.
      get showLabels() {
        return false
      },

      get showDescriptions() {
        return false
      },

      get effectiveShowDescriptions() {
        return false
      },

      get maxFeatureDensity() {
        return (
          self.userFeatureDensityLimit ??
          self.getConfWithOverride<number>('maxFeatureScreenDensity')
        )
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
      get numSources() {
        return self.sources.length
      },
      get laneIndexByKey() {
        const map = new Map<string, number>()
        for (const [i, s] of self.sources.entries()) {
          map.set(s.name, i)
        }
        return map
      },
      // Display config sent to the worker. Every field becomes a cache key
      // via SettingsInvalidate, so keep fetch-result-derived values out of
      // here (the `sources` list is allowed because changing it requires
      // a refetch anyway).
      rpcProps() {
        return {
          displayConfig: {
            ...getConfSnapshot(self.configuration),
            ...self.configOverrides,
          } as MultiBedDisplayConfig,
          maxFeatureDensity: self.maxFeatureDensity,
          sources: self.sources.map(s => ({ name: s.name })),
        }
      },
    }))
    .views(self => ({
      get laidOutDataMap(): Map<number, FeatureDataResult> {
        const view = getContainingView(self) as LGV
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return new Map()
        }
        return computeLaneLaidOutData(self.rpcDataMap, {
          laneIndexByKey: self.laneIndexByKey,
          laneHeight: self.laneHeight,
          laneGap: self.laneGap,
        })
      },
    }))
    .views(self => ({
      get totalLaneHeight() {
        return self.numSources * (self.laneHeight + self.laneGap)
      },

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
        return indexById<SubfeatureInfo>(
          self.laidOutDataMap,
          d => d.subfeatureInfos,
        )
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
    .views(_self => ({
      // Empty flatbush indexes per region — full implementation lives in
      // LinearBasicDisplay/components/hitTesting; we'd reuse it here but the
      // multi-bed display doesn't need floating-label hit-testing yet.
      get flatbushIndexes() {
        return new Map()
      },
    }))
    .actions(self => ({
      setRpcData(
        displayedRegionIndex: number,
        data: MultiBedRenderResult,
        loadedBpPerPx: number,
      ) {
        self.rpcDataMap.set(displayedRegionIndex, { ...data, loadedBpPerPx })
        // Discover lane keys from features when adapter doesn't expose
        // getSources (single-adapter laneField=sample case). Once seen, the
        // key sticks in sourcesVolatile until reload.
        if (data.discoveredSources.length > 0) {
          const known = new Set(self.sourcesVolatile.map(s => s.name))
          const additions: SourceInfo[] = []
          for (const key of data.discoveredSources) {
            if (!known.has(key)) {
              additions.push({ name: key })
              known.add(key)
            }
          }
          if (additions.length > 0) {
            self.sourcesVolatile = [...self.sourcesVolatile, ...additions]
          }
        }
      },

      setSources(sources: SourceInfo[]) {
        self.sourcesVolatile = sources
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
        self.setScrollTop(0)
        self.rpcDataMap.clear()
        self.densityStatsPerRegion.clear()
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

      setLayout(layout: SourceInfo[]) {
        self.layout.replace(layout)
      },
    }))
    .actions(self => ({
      showContextMenuForFeature(
        featureInfo: FlatbushItem,
        displayedRegionIndex: number,
      ) {
        self.setContextMenuInfo({ item: featureInfo, displayedRegionIndex })
      },

      clearSelection() {
        getSession(self).clearSelection()
      },

      selectFeatureById(
        _featureInfo: FlatbushItem,
        _subfeatureInfo: SubfeatureInfo | undefined,
        _displayedRegionIndex: number,
      ) {
        // No-op for now — could open feature details widget by re-fetching
        // a single feature, similar to LinearBasicDisplay.selectFullFeature.
      },

      async fetchFullFeature(
        _featureId: string,
        _displayedRegionIndex: number,
      ) {
        return undefined
      },

      isCacheValid(displayedRegionIndex: number) {
        return self.rpcDataMap.get(displayedRegionIndex) !== undefined
      },
    }))
    .actions(self => {
      interface FetchOk {
        kind: 'ok'
        displayedRegionIndex: number
        data: MultiBedRenderResult
        region: Region
        bpPerPx: number
      }
      interface FetchTooLarge {
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
      ): Promise<FetchOk | FetchTooLarge> {
        const sessionId = getRpcSessionId(self)
        const result = await getSession(self).rpcManager.call(
          sessionId,
          'RenderMultiBedData',
          {
            sessionId,
            adapterConfig: self.adapterConfig,
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

      function applyFetchResults(results: (FetchOk | FetchTooLarge)[]) {
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
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return
          }
          self.clearAllRpcData()
          self.setSources([])
          self.fetchNeeded(view.bufferedVisibleRegions)
        },

        fetchNeeded(
          needed: { region: Region; displayedRegionIndex: number }[],
        ) {
          const view = getContainingView(self) as LGV
          const bpPerPx = view.bpPerPx
          self.pruneRpcDataMapToVisible(
            new Set(
              view.bufferedVisibleRegions.map(b => b.displayedRegionIndex),
            ),
          )
          void self.fetchRegions(needed, async (ctx: FetchContext) => {
            const results = await Promise.all(
              needed.map(({ region, displayedRegionIndex }) =>
                fetchFeaturesForRegion(
                  region,
                  displayedRegionIndex,
                  bpPerPx,
                  ctx.stopToken,
                ),
              ),
            )
            if (ctx.isStale()) {
              return
            }
            applyFetchResults(results)
          })
        },
      }
    })
    .actions(self => {
      const superAfterAttach = self.afterAttach
      return {
        afterAttach() {
          superAfterAttach()

          addDisposer(
            self,
            autorun(
              () => {
                if (!self.autoHeight) {
                  return
                }
                const target = Math.min(
                  Math.max(self.totalLaneHeight, 50),
                  self.maxHeight,
                )
                if (target > 0) {
                  self.setHeight(target)
                }
              },
              { name: 'MultiBedAutoHeight' },
            ),
          )
        },
      }
    })
    .views(_self => ({
      showSubmenuMenuItems() {
        return [] as { label: string; type: 'checkbox' }[]
      },
      trackMenuItems() {
        return [] as { label: string }[]
      },
      contextMenuItems() {
        return [] as { label: string; onClick: () => void }[]
      },
    }))
}

export type MultiLinearBasicDisplayModel = ReturnType<typeof stateModelFactory>
