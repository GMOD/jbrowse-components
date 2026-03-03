import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
  isAbortException,
  isFeature,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  MultiRegionDisplayMixin,
  RegionTooLargeMixin,
  TrackHeightMixin,
  getDisplayStr,
} from '@jbrowse/plugin-linear-genome-view'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun, reaction } from 'mobx'

import {
  getTranscripts,
  hasIntrons,
} from './components/CollapseIntronsDialog/util.ts'

const CollapseIntronsDialog = lazy(
  () => import('./components/CollapseIntronsDialog/CollapseIntronsDialog.tsx'),
)

import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
  MultiRegionRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function computeAndAssignLayout(
  rpcDataMap: Map<number, FeatureDataResult>,
  bpPerPx: number,
) {
  const entries = [...rpcDataMap.entries()].filter(
    ([, d]) => d.flatbushItems.length > 0,
  )
  if (entries.length === 0) {
    return
  }

  // Collect all unique features across all regions (keyed by featureId).
  // bottomPx equals layoutHeight since topPx is always 0 from the worker.
  const allFeatures = new Map<
    string,
    { startBp: number; layoutEndBp: number; height: number }
  >()
  for (const [, data] of entries) {
    for (const item of data.flatbushItems) {
      if (!allFeatures.has(item.featureId)) {
        allFeatures.set(item.featureId, {
          startBp: item.startBp,
          layoutEndBp: item.layoutEndBp,
          height: item.bottomPx,
        })
      }
    }
  }

  // Use GranularRectLayout for efficient 2D packing with label-width awareness.
  // Convert bp coordinates to pixel coordinates for the layout.
  const layout = new GranularRectLayout({ displayMode: 'normal' })
  const layoutMap = new Map<string, number>()

  const sorted = [...allFeatures.entries()].sort(
    ([, a], [, b]) => a.startBp - b.startBp,
  )

  for (const [id, { startBp, layoutEndBp, height }] of sorted) {
    const leftPx = startBp / bpPerPx
    const rightPx = layoutEndBp / bpPerPx
    const top = layout.addRect(id, leftPx, rightPx, height)
    layoutMap.set(id, top ?? 0)
  }

  for (const [, data] of entries) {
    fillYArrays(data, layoutMap)
  }
}

function fillYArrays(data: FeatureDataResult, layoutMap: Map<string, number>) {
  // Pre-build per-flatbushItem y-offset to avoid repeated Map lookups
  const featureYOffsets = new Float32Array(data.flatbushItems.length)
  for (const [i, item] of data.flatbushItems.entries()) {
    featureYOffsets[i] = layoutMap.get(item.featureId) ?? 0
  }

  for (let i = 0; i < data.numRects; i++) {
    data.rectYs[i] =
      data.rectYs[i]! + featureYOffsets[data.rectFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.numLines; i++) {
    data.lineYs[i] =
      data.lineYs[i]! + featureYOffsets[data.lineFeatureIndices[i]!]!
  }
  for (let i = 0; i < data.numArrows; i++) {
    data.arrowYs[i] =
      data.arrowYs[i]! + featureYOffsets[data.arrowFeatureIndices[i]!]!
  }

  for (const [i, item] of data.flatbushItems.entries()) {
    const offset = featureYOffsets[i]!
    item.topPx = offset
    item.bottomPx = item.bottomPx + offset
  }

  for (const info of data.subfeatureInfos) {
    const offset = layoutMap.get(info.parentFeatureId) ?? 0
    const height = info.bottomPx - info.topPx
    info.topPx = info.topPx + offset
    info.bottomPx = info.topPx + height
  }

  for (const labelData of Object.values(data.floatingLabelsData)) {
    labelData.topY = labelData.topY + (layoutMap.get(labelData.featureId) ?? 0)
  }

  if (data.aminoAcidOverlay) {
    for (const aaItem of data.aminoAcidOverlay) {
      aaItem.topPx = aaItem.topPx + featureYOffsets[aaItem.flatbushIdx]!
    }
  }

  let maxY = 0
  for (const item of data.flatbushItems) {
    if (item.bottomPx > maxY) {
      maxY = item.bottomPx
    }
  }
  data.maxY = maxY

  // New array references so client-side flatbush cache rebuilds
  data.flatbushItems = [...data.flatbushItems]
  data.subfeatureInfos = [...data.subfeatureInfos]
}

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

export type { MultiRegionRegion as Region } from '@jbrowse/plugin-linear-genome-view'

const FeatureComponent = lazy(() => import('./components/FeatureComponent.tsx'))

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearFeatureDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      RegionTooLargeMixin(),
      types.model({
        type: types.literal('LinearFeatureDisplay'),
        configuration: ConfigurationReference(configSchema),
        trackShowLabels: types.maybe(types.boolean),
        trackShowDescriptions: types.maybe(types.boolean),
        trackSubfeatureLabels: types.maybe(types.string),
        trackGeneGlyphMode: types.maybe(types.string),
        trackDisplayMode: types.maybe(types.string),
        showOnlyGenes: false,
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplay/FeatureDensityMixin snapshots
      const {
        blockState,
        showLegend,
        showTooltips,
        userBpPerPxLimit,
        userByteSizeLimit,
        ...cleaned
      } = snap
      snap = cleaned

      // Rewrite "height" from older snapshots to "heightPreConfig"
      if (snap.height !== undefined && snap.heightPreConfig === undefined) {
        const { height, ...rest } = snap
        snap = { ...rest, heightPreConfig: height }
      }

      return snap
    })
    .volatile(() => ({
      rpcDataMap: new Map<number, FeatureDataResult>(),
      layoutBpPerPxMap: new Map<number, number>(),
      maxY: 0,
      featureIdUnderMouse: null as string | null,
      mouseoverExtraInformation: undefined as string | undefined,
      contextMenuInfo: undefined as
        | { feature: Feature; regionNumber: number }
        | undefined,
    }))
    .views(self => ({
      get adapterConfigSnapshot() {
        return getConf(getContainingTrack(self), 'adapter') as Record<
          string,
          unknown
        >
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

      renderProps() {
        return { notReady: true }
      },

      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },

      get maxHeight(): number {
        return getConf(self, 'maxHeight') ?? 1200
      },

      get autoHeight(): boolean {
        return getConf(self, 'autoHeight') ?? false
      },

      get showLabels(): boolean {
        return self.trackShowLabels ?? true
      },

      get showDescriptions(): boolean {
        return self.trackShowDescriptions ?? true
      },

      get subfeatureLabels(): string {
        return self.trackSubfeatureLabels ?? 'none'
      },

      get displayMode(): string {
        return self.trackDisplayMode ?? 'normal'
      },

      get geneGlyphMode(): string {
        return self.trackGeneGlyphMode ?? 'auto'
      },

      get effectiveGeneGlyphMode(): string {
        const mode = self.trackGeneGlyphMode ?? 'auto'
        if (mode === 'auto') {
          const view = getContainingView(self) as LGV
          return view.bpPerPx > 100 ? 'longest' : 'all'
        }
        return mode
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

      get fetchSizeLimit() {
        return (
          self.userByteSizeLimit || (getConf(self, 'fetchSizeLimit') as number)
        )
      },

      get colorByCDS() {
        const view = getContainingView(self) as LGV
        return (view as unknown as { colorByCDS?: boolean }).colorByCDS ?? false
      },

      get sequenceAdapter() {
        const { assemblyManager } = getSession(self)
        const track = getContainingTrack(self)
        const assemblyNames = readConfObject(
          track.configuration,
          'assemblyNames',
        ) as string[]
        const assembly = assemblyManager.get(assemblyNames[0]!)
        return assembly ? getConf(assembly, ['sequence', 'adapter']) : undefined
      },

      get needsLayoutRefresh() {
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized || self.layoutBpPerPxMap.size === 0) {
            return false
          }
          for (const layoutBpPerPx of self.layoutBpPerPxMap.values()) {
            const ratio = view.bpPerPx / layoutBpPerPx
            if (ratio > 2 || ratio < 0.5) {
              return true
            }
          }
          return false
        } catch {
          return false
        }
      },

      getFeatureById(featureId: string): FlatbushItem | undefined {
        for (const data of self.rpcDataMap.values()) {
          const found = data.flatbushItems.find(f => f.featureId === featureId)
          if (found) {
            return found
          }
        }
        return undefined
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
    }))
    .actions(self => ({
      setRpcDataMap(dataMap: Map<number, FeatureDataResult>) {
        self.rpcDataMap = dataMap
        let globalMaxY = 0
        for (const d of dataMap.values()) {
          globalMaxY = Math.max(globalMaxY, d.maxY)
        }
        self.maxY = globalMaxY
        if (self.autoHeight) {
          self.setHeight(Math.min(Math.max(globalMaxY, 50), self.maxHeight))
        }
      },

      setLayoutBpPerPxForRegion(regionNumber: number, bpPerPx: number) {
        const next = new Map(self.layoutBpPerPxMap)
        next.set(regionNumber, bpPerPx)
        self.layoutBpPerPxMap = next
      },

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.layoutBpPerPxMap = new Map()
        self.setRegionTooLarge(false)
      },

      setFeatureIdUnderMouse(featureId: string | null) {
        self.featureIdUnderMouse = featureId
      },

      setMouseoverExtraInformation(info: string | undefined) {
        self.mouseoverExtraInformation = info
      },

      setContextMenuInfo(info?: { feature: Feature; regionNumber: number }) {
        self.contextMenuInfo = info
      },
    }))
    .actions(self => ({
      selectFeature(feature: Feature) {
        const session = getSession(self)
        session.setSelection(feature)
        if (isSessionModelWithWidgets(session)) {
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const { type, id } = self.featureWidgetType
          session.showWidget(
            session.addWidget(type, id, {
              featureData: feature.toJSON(),
              view,
              track,
            }),
          )
        }
      },

      clearSelection() {
        getSession(self).clearSelection()
      },

      setShowLabels(value: boolean) {
        self.trackShowLabels = value
      },

      setShowDescriptions(value: boolean) {
        self.trackShowDescriptions = value
      },

      setSubfeatureLabels(value: string) {
        self.trackSubfeatureLabels = value
      },

      setGeneGlyphMode(value: string) {
        self.trackGeneGlyphMode = value
      },

      setDisplayMode(value: string) {
        self.trackDisplayMode = value
      },

      setShowOnlyGenes(value: boolean) {
        self.showOnlyGenes = value
      },

      showContextMenuForFeature(
        featureInfo: FlatbushItem,
        regionNumber: number,
      ) {
        const feature = new SimpleFeature({
          id: featureInfo.featureId,
          data: {
            uniqueId: featureInfo.featureId,
            type: featureInfo.type,
            start: featureInfo.startBp,
            end: featureInfo.endBp,
            name: featureInfo.name,
            strand: featureInfo.strand,
          },
        })
        self.setContextMenuInfo({ feature, regionNumber })
      },
    }))
    .actions(self => ({
      fetchFullFeature: flow(function* (
        featureId: string,
        regionNumber: number,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const adapterConfig = self.adapterConfigSnapshot

        const region = self.loadedRegions.get(regionNumber)
        if (!region) {
          return undefined
        }

        try {
          const result = yield rpcManager.call(
            getRpcSessionId(self),
            'GetCanvasFeatureDetails',
            {
              adapterConfig,
              featureId,
              region,
            },
          )

          if (result.feature && isAlive(self)) {
            return new SimpleFeature(result.feature)
          }
        } catch (e) {
          console.error('Failed to fetch feature details:', e)
          session.notifyError(`${e}`, e)
        }
        return undefined
      }),
    }))
    .actions(self => ({
      selectFullFeature: flow(function* (
        featureId: string,
        regionNumber: number,
      ) {
        const feature: Feature | undefined = yield self.fetchFullFeature(
          featureId,
          regionNumber,
        )
        if (feature) {
          self.selectFeature(feature)
        }
      }),

      selectFeatureById: flow(function* (
        featureInfo: FlatbushItem,
        subfeatureInfo: SubfeatureInfo | undefined,
        regionNumber: number,
      ) {
        const featureIdToFetch = subfeatureInfo
          ? subfeatureInfo.parentFeatureId
          : featureInfo.featureId

        const parentFeature: Feature | undefined = yield self.fetchFullFeature(
          featureIdToFetch,
          regionNumber,
        )

        if (parentFeature) {
          if (subfeatureInfo) {
            const subfeature = findSubfeatureById(
              parentFeature,
              subfeatureInfo.featureId,
            )
            if (subfeature) {
              self.selectFeature(subfeature)
            } else {
              self.selectFeature(parentFeature)
            }
          } else {
            self.selectFeature(parentFeature)
          }
        }
      }),
    }))
    .actions(self => {
      interface FetchResult {
        regionNumber: number
        data: FeatureDataResult
        region: Region
        bpPerPx: number
      }

      async function fetchFeaturesForRegion(
        region: Region,
        regionNumber: number,
        bpPerPx: number,
        stopToken: string,
      ): Promise<FetchResult | undefined> {
        const session = getSession(self)
        const { rpcManager } = session
        const adapterConfig = self.adapterConfigSnapshot

        const result = await rpcManager.call(
          getRpcSessionId(self),
          'RenderFeatureData',
          {
            adapterConfig,
            displayConfig: {
              showLabels: self.showLabels,
              showDescriptions: self.showDescriptions,
              subfeatureLabels: self.subfeatureLabels,
              geneGlyphMode: self.effectiveGeneGlyphMode,
              displayMode: self.displayMode,
            },
            region,
            bpPerPx,
            colorByCDS: self.colorByCDS,
            sequenceAdapter: self.sequenceAdapter,
            showOnlyGenes: self.showOnlyGenes,
            stopToken,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )

        if ('regionTooLarge' in result) {
          throw new Error(
            `Unexpected regionTooLarge from RPC (maxFeatureCount should not be sent)`,
          )
        }
        return { regionNumber, data: result, region, bpPerPx }
      }

      function applyFetchResults(
        results: (FetchResult | undefined)[],
        bpPerPx: number,
      ) {
        self.setRegionTooLarge(false, '')
        const dataMap = new Map(self.rpcDataMap)
        for (const r of results) {
          if (r) {
            dataMap.set(r.regionNumber, r.data)
          }
        }
        computeAndAssignLayout(dataMap, bpPerPx)
        for (const r of results) {
          if (r) {
            self.setLoadedRegionForRegion(r.regionNumber, r.region)
            self.setLayoutBpPerPxForRegion(r.regionNumber, r.bpPerPx)
          }
        }
        self.setRpcDataMap(dataMap)
      }

      async function fetchByteEstimate(regions: Region[]) {
        const session = getSession(self)
        const sessionId = getRpcSessionId(self)
        return session.rpcManager.call(
          sessionId,
          'CoreGetFeatureDensityStats',
          {
            regions,
            adapterConfig: self.adapterConfigSnapshot,
          },
        ) as Promise<{ bytes?: number; fetchSizeLimit?: number }>
      }

      async function fetchRegions(
        regions: { region: Region; regionNumber: number }[],
        bpPerPx: number,
      ) {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
        const stopToken = createStopToken()
        const generation = self.fetchGeneration
        self.setRenderingStopToken(stopToken)
        self.setLoading(true)
        self.setError(null)
        try {
          // Byte estimate check. Uses the adapter index (e.g. tabix,
          // BAI) to estimate compressed bytes for the visible regions.
          // If the estimate exceeds fetchSizeLimit, show the "force
          // load" banner immediately without fetching features.
          // Regions smaller than AUTO_FORCE_LOAD_BP always load
          // unconditionally.
          const view = getContainingView(self) as LGV
          if (view.visibleBp >= AUTO_FORCE_LOAD_BP) {
            const stats = await fetchByteEstimate(regions.map(r => r.region))
            if (
              !isAlive(self) ||
              self.fetchGeneration !== generation ||
              self.renderingStopToken !== stopToken
            ) {
              return
            }
            self.setFeatureDensityStats(stats)
            if (stats.bytes && stats.bytes > self.fetchSizeLimit) {
              self.setRegionTooLarge(
                true,
                `Requested too much data (${getDisplayStr(stats.bytes)})`,
              )
              return
            }
          }

          const promises = regions.map(({ region, regionNumber }) =>
            fetchFeaturesForRegion(region, regionNumber, bpPerPx, stopToken),
          )
          const results = await Promise.all(promises)
          if (
            isAlive(self) &&
            self.fetchGeneration === generation &&
            self.renderingStopToken === stopToken
          ) {
            applyFetchResults(results, bpPerPx)
          }
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Failed to fetch features:', e)
            if (
              isAlive(self) &&
              self.fetchGeneration === generation &&
              self.renderingStopToken === stopToken
            ) {
              self.setError(e instanceof Error ? e : new Error(String(e)))
            }
          }
        } finally {
          if (
            isAlive(self) &&
            self.fetchGeneration === generation &&
            self.renderingStopToken === stopToken
          ) {
            self.setRenderingStopToken(undefined)
            self.setLoading(false)
            self.setStatusMessage(undefined)
          }
        }
      }

      async function refetchForCurrentView() {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        self.clearAllRpcData()
        const bpPerPx = view.bpPerPx
        const regions = view.staticRegions.map(vr => ({
          region: vr as Region,
          regionNumber: vr.regionNumber,
        }))
        await fetchRegions(regions, bpPerPx)
      }

      const superAfterAttach = self.afterAttach

      return {
        async reload() {
          // refetch contains all its async behavior, so no need to await
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          refetchForCurrentView()
        },

        afterAttach() {
          superAfterAttach()
          // adapterConfigSnapshot is only accessed inside a conditional branch
          // (when new regions need fetching), so MobX drops it from the
          // dependency set when no fetch is needed and suspends the computed.
          // This no-op autorun keeps it observed so idMaker isn't re-called on
          // every fetch.
          addDisposer(
            self,
            autorun(() => {
              void self.adapterConfigSnapshot
            }),
          )
          // Autorun: fetch data for all visible regions
          addDisposer(
            self,
            autorun(
              async () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (
                  !view.initialized ||
                  self.regionTooLarge ||
                  self.isLoading ||
                  self.error
                ) {
                  return
                }

                if (self.needsLayoutRefresh) {
                  self.clearAllRpcData()
                }

                const bpPerPx = view.bpPerPx
                const staticRegs = view.staticRegions
                const needed: { region: Region; regionNumber: number }[] = []
                for (const vr of staticRegs) {
                  const loaded = self.loadedRegions.get(vr.regionNumber)
                  if (
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end
                  ) {
                    continue
                  }
                  needed.push({
                    region: vr as Region,
                    regionNumber: vr.regionNumber,
                  })
                }
                if (needed.length > 0) {
                  await fetchRegions(needed, bpPerPx)
                }
              },
              {
                name: 'FetchVisibleRegions',
                delay: 300,
              },
            ),
          )

          // Autorun: when zoom changes while regionTooLarge is set, clear
          // the flag so the fetch autorun retries with the new (smaller) region
          let prevBpPerPx: number | undefined
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                const bpPerPx = view.bpPerPx
                if (
                  prevBpPerPx !== undefined &&
                  bpPerPx !== prevBpPerPx &&
                  self.regionTooLarge
                ) {
                  self.clearAllRpcData()
                }
                prevBpPerPx = bpPerPx
              },
              { name: 'ClearTooLargeOnZoom' },
            ),
          )

          // Reaction: re-fetch when label/description/colorByCDS settings change
          addDisposer(
            self,
            reaction(
              () => ({
                showLabels: self.showLabels,
                showDescriptions: self.showDescriptions,
                subfeatureLabels: self.subfeatureLabels,
                colorByCDS: self.colorByCDS,
                geneGlyphMode: self.effectiveGeneGlyphMode,
                showOnlyGenes: self.showOnlyGenes,
                displayMode: self.displayMode,
              }),
              () => {
                if (self.loadedRegions.size > 0 || self.regionTooLarge) {
                  // refetch contains all its async behavior, so no need to await
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  refetchForCurrentView()
                }
              },
              {
                name: 'SettingsRefetch',
                delay: 100,
                fireImmediately: false,
                equals: (a, b) =>
                  a.showLabels === b.showLabels &&
                  a.showDescriptions === b.showDescriptions &&
                  a.subfeatureLabels === b.subfeatureLabels &&
                  a.colorByCDS === b.colorByCDS &&
                  a.geneGlyphMode === b.geneGlyphMode &&
                  a.showOnlyGenes === b.showOnlyGenes &&
                  a.displayMode === b.displayMode,
              },
            ),
          )
        },
      }
    })

    .views(self => ({
      get contextMenuFeature() {
        return self.contextMenuInfo?.feature
      },
    }))
    .views(self => ({
      get isGeneLike() {
        const type = `${self.contextMenuFeature?.get('type')}`.toLowerCase()
        return (
          type.includes('gene') ||
          type.includes('rna') ||
          type.includes('transcript')
        )
      },
    }))
    .views(self => ({
      contextMenuItems() {
        const info = self.contextMenuInfo
        if (!info) {
          return []
        }
        const { feature: feat, regionNumber } = info
        const region = self.loadedRegions.get(regionNumber)
        return [
          {
            label: 'Open feature details',
            icon: MenuOpenIcon,
            onClick: () => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              self.selectFullFeature(feat.id(), regionNumber)
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
                  start: feat.get('start'),
                  end: feat.get('end'),
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
                const fullFeature = await self.fetchFullFeature(
                  feat.id(),
                  regionNumber,
                )
                if (!fullFeature) {
                  return
                }
                const session = getSession(self)
                const { uniqueId: _, ...rest } = fullFeature.toJSON()
                const { default: copy } = await import('copy-to-clipboard')
                copy(JSON.stringify(rest, null, 4))
                session.notify('Copied to clipboard', 'success')
              })()
            },
          },
          ...(self.isGeneLike
            ? [
                {
                  label: 'Collapse introns',
                  icon: CloseFullscreenIcon,
                  onClick: () => {
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    ;(async () => {
                      const fullFeature = await self.fetchFullFeature(
                        feat.id(),
                        regionNumber,
                      )
                      if (!fullFeature) {
                        return
                      }
                      const session = getSession(self)
                      const transcripts = getTranscripts(fullFeature)
                      if (!hasIntrons(transcripts)) {
                        session.notify(
                          'No introns found in this feature',
                          'info',
                        )
                        return
                      }
                      const view = getContainingView(self) as LGV
                      const { assemblyManager } = session
                      const assembly = assemblyManager.get(
                        view.assemblyNames[0]!,
                      )
                      if (assembly) {
                        session.queueDialog(handleClose => [
                          CollapseIntronsDialog,
                          { view, transcripts, handleClose, assembly },
                        ])
                      }
                    })()
                  },
                },
              ]
            : []),
        ]
      },

      trackMenuItems() {
        return [
          {
            label: 'Show...',
            icon: VisibilityIcon,
            subMenu: [
              {
                label: 'Show labels',
                type: 'checkbox',
                checked: self.showLabels,
                onClick: () => {
                  self.setShowLabels(!self.showLabels)
                },
              },
              {
                label: 'Show descriptions',
                type: 'checkbox',
                checked: self.showDescriptions,
                onClick: () => {
                  self.setShowDescriptions(!self.showDescriptions)
                },
              },
              {
                label: 'Show only genes',
                type: 'checkbox',
                checked: self.showOnlyGenes,
                onClick: () => {
                  self.setShowOnlyGenes(!self.showOnlyGenes)
                },
              },
            ],
          },
          {
            label: 'Transcript labels',
            subMenu: (
              [
                { value: 'none', label: 'None' },
                { value: 'overlay', label: 'Overlay' },
                { value: 'below', label: 'Below' },
              ] as const
            ).map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.subfeatureLabels === value,
              onClick: () => {
                self.setSubfeatureLabels(value)
              },
            })),
          },
          {
            label: 'Gene glyph',
            subMenu: (
              [
                { value: 'auto', label: 'Auto' },
                { value: 'all', label: 'All transcripts' },
                { value: 'longest', label: 'Longest transcript' },
                { value: 'longestCoding', label: 'Longest coding transcript' },
              ] as const
            ).map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.geneGlyphMode === value,
              onClick: () => {
                self.setGeneGlyphMode(value)
              },
            })),
          },
          {
            label: 'Display mode',
            subMenu: (
              [
                { value: 'normal', label: 'Normal' },
                { value: 'compact', label: 'Compact' },
              ] as const
            ).map(({ value, label }) => ({
              label,
              type: 'radio' as const,
              checked: self.displayMode === value,
              onClick: () => {
                self.setDisplayMode(value)
              },
            })),
          },
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      const {
        trackShowLabels,
        trackShowDescriptions,
        trackSubfeatureLabels,
        trackGeneGlyphMode,
        trackDisplayMode,
        showOnlyGenes,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackShowLabels !== undefined && { trackShowLabels }),
        ...(trackShowDescriptions !== undefined && { trackShowDescriptions }),
        ...(trackSubfeatureLabels !== undefined && { trackSubfeatureLabels }),
        ...(trackGeneGlyphMode !== undefined && { trackGeneGlyphMode }),
        ...(trackDisplayMode !== undefined && { trackDisplayMode }),
        ...(showOnlyGenes && { showOnlyGenes }),
      } as typeof snap
    })
}

export type LinearFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearFeatureDisplayModel = Instance<LinearFeatureDisplayStateModel>
