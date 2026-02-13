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
import {
  createStopToken,
  stopStopToken,
} from '@jbrowse/core/util/stopToken'
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import { TrackHeightMixin } from '@jbrowse/plugin-linear-genome-view'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun } from 'mobx'

import type {
  FlatbushItem,
  RenderWebGLFeatureDataResult,
  SubfeatureInfo,
  WebGLFeatureDataResult,
} from '../RenderWebGLFeatureDataRPC/rpcTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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

export interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

const WebGLFeatureComponent = lazy(
  () => import('./components/WebGLFeatureComponent.tsx'),
)

const WebGLFeatureTooltip = lazy(
  () => import('./components/WebGLFeatureTooltip.tsx'),
)

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearWebGLFeatureDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      types.model({
        type: types.literal('LinearWebGLFeatureDisplay'),
        configuration: ConfigurationReference(configSchema),
        trackShowLabels: types.maybe(types.boolean),
        trackShowDescriptions: types.maybe(types.boolean),
        trackGeneGlyphMode: types.maybe(types.string),
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
      rpcDataMap: new Map<number, WebGLFeatureDataResult>(),
      loadedRegions: new Map<number, Region>(),
      layoutBpPerPxMap: new Map<number, number>(),
      isLoading: false,
      error: null as Error | null,
      maxY: 0,
      featureIdUnderMouse: null as string | null,
      mouseoverExtraInformation: undefined as string | undefined,
      contextMenuFeature: undefined as Feature | undefined,
      regionTooLarge: false,
      featureCount: 0,
      userForceLoadLimit: undefined as number | undefined,
      fetchGeneration: 0,
      renderingStopToken: undefined as string | undefined,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WebGLFeatureComponent
      },

      get TooltipComponent() {
        return WebGLFeatureTooltip
      },

      get showTooltipsEnabled() {
        return true
      },

      get showLegend() {
        return false
      },

      renderProps() {
        return { notReady: true }
      },

      get maxHeight(): number {
        return getConf(self, 'maxHeight') ?? 1200
      },

      get showLabels(): boolean {
        return self.trackShowLabels ?? true
      },

      get showDescriptions(): boolean {
        return self.trackShowDescriptions ?? true
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

      get maxFeatureScreenDensity(): number {
        return getConf(self, 'maxFeatureScreenDensity') ?? 0.3
      },

      get maxFeatureCount() {
        if (self.userForceLoadLimit !== undefined) {
          return self.userForceLoadLimit
        }
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return undefined
        }
        return Math.round(this.maxFeatureScreenDensity * view.width)
      },

      get regionTooLargeReason() {
        if (self.regionTooLarge) {
          return `Too many features (${self.featureCount} in region)`
        }
        return ''
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

      // Find a loaded region that contains the given bp range
      findLoadedRegionForFeature(
        startBp: number,
        endBp: number,
      ): Region | undefined {
        for (const region of self.loadedRegions.values()) {
          if (startBp >= region.start && endBp <= region.end) {
            return region
          }
        }
        return undefined
      },

      get featureWidgetType() {
        return {
          type: 'BaseFeatureWidget',
          id: 'baseFeature',
        }
      },
    }))
    .actions(self => ({
      setRpcDataForRegion(regionNumber: number, data: WebGLFeatureDataResult) {
        const next = new Map(self.rpcDataMap)
        next.set(regionNumber, data)
        self.rpcDataMap = next
        // Update maxY from all regions
        let globalMaxY = 0
        for (const d of next.values()) {
          globalMaxY = Math.max(globalMaxY, d.maxY)
        }
        self.maxY = globalMaxY
      },

      setLoadedRegionForRegion(regionNumber: number, region: Region) {
        const next = new Map(self.loadedRegions)
        next.set(regionNumber, region)
        self.loadedRegions = next
      },

      setLayoutBpPerPxForRegion(regionNumber: number, bpPerPx: number) {
        const next = new Map(self.layoutBpPerPxMap)
        next.set(regionNumber, bpPerPx)
        self.layoutBpPerPxMap = next
      },

      clearAllRpcData() {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
          self.renderingStopToken = undefined
        }
        self.rpcDataMap = new Map()
        self.loadedRegions = new Map()
        self.layoutBpPerPxMap = new Map()
        self.regionTooLarge = false
        self.featureCount = 0
        self.fetchGeneration++
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setRenderingStopToken(token: string | undefined) {
        self.renderingStopToken = token
      },

      setFeatureIdUnderMouse(featureId: string | null) {
        ;(self as any).featureIdUnderMouse = featureId
      },

      setMouseoverExtraInformation(info: string | undefined) {
        self.mouseoverExtraInformation = info
      },

      setContextMenuFeature(feature?: Feature) {
        self.contextMenuFeature = feature
      },

      setRegionTooLarge(tooLarge: boolean, count: number) {
        self.regionTooLarge = tooLarge
        self.featureCount = count
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

      setGeneGlyphMode(value: string) {
        self.trackGeneGlyphMode = value
      },

      setShowOnlyGenes(value: boolean) {
        self.showOnlyGenes = value
      },

      showContextMenuForFeature(featureInfo: FlatbushItem) {
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
        self.setContextMenuFeature(feature)
      },
    }))
    .actions(self => ({
      selectFeatureById: flow(function* (
        featureInfo: FlatbushItem,
        subfeatureInfo?: SubfeatureInfo,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        // Find a loaded region that contains this feature
        const region = self.findLoadedRegionForFeature(
          featureInfo.startBp,
          featureInfo.endBp,
        )
        if (!region) {
          return
        }

        const featureIdToFetch = subfeatureInfo
          ? subfeatureInfo.parentFeatureId
          : featureInfo.featureId

        try {
          const result = (yield rpcManager.call(
            session.id ?? '',
            'GetWebGLFeatureDetails',
            {
              sessionId: session.id,
              adapterConfig,
              featureId: featureIdToFetch,
              region,
            },
          )) as { feature: Record<string, unknown> | undefined }

          if (result.feature && isAlive(self)) {
            // @ts-expect-error
            const parentFeature = new SimpleFeature(result.feature)

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
        } catch (e) {
          console.error('Failed to fetch feature details:', e)
          session.notifyError(`${e}`, e)
        }
      }),
    }))
    .actions(self => {
      type FetchResult =
        | {
            tooLarge: true
            featureCount: number
            regionNumber: number
            region: Region
          }
        | {
            tooLarge: false
            regionNumber: number
            data: WebGLFeatureDataResult
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
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return undefined
        }

        const result = (await rpcManager.call(
          session.id ?? '',
          'RenderWebGLFeatureData',
          {
            sessionId: session.id,
            adapterConfig,
            displayConfig: {
              showLabels: self.showLabels,
              showDescriptions: self.showDescriptions,
              geneGlyphMode: self.effectiveGeneGlyphMode,
            },
            region,
            bpPerPx,
            colorByCDS: self.colorByCDS,
            sequenceAdapter: self.sequenceAdapter,
            showOnlyGenes: self.showOnlyGenes,
            maxFeatureCount: self.maxFeatureCount,
            stopToken,
          },
        )) as RenderWebGLFeatureDataResult

        if ('regionTooLarge' in result) {
          return {
            tooLarge: true,
            featureCount: result.featureCount,
            regionNumber,
            region,
          }
        }
        return { tooLarge: false, regionNumber, data: result, region, bpPerPx }
      }

      function applyFetchResults(results: (FetchResult | undefined)[]) {
        let totalTooLargeCount = 0
        let anyTooLarge = false
        for (const r of results) {
          if (r?.tooLarge) {
            anyTooLarge = true
            totalTooLargeCount += r.featureCount
          }
        }
        if (anyTooLarge) {
          // Set the flag — the autorun is gated on regionTooLarge so it
          // won't retry. A bpPerPx reaction clears the flag on zoom,
          // which lets the autorun fire fresh for all regions.
          self.setRegionTooLarge(true, totalTooLargeCount)
        } else {
          self.setRegionTooLarge(false, 0)
          for (const r of results) {
            if (r && !r.tooLarge) {
              self.setRpcDataForRegion(r.regionNumber, r.data)
              self.setLoadedRegionForRegion(r.regionNumber, r.region)
              self.setLayoutBpPerPxForRegion(r.regionNumber, r.bpPerPx)
            }
          }
        }
      }

      async function fetchRegions(
        regions: { region: Region; regionNumber: number }[],
        bpPerPx: number,
      ) {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
        const stopToken = createStopToken()
        self.setRenderingStopToken(stopToken)
        const generation = self.fetchGeneration
        self.setLoading(true)
        self.setError(null)
        try {
          const promises = regions.map(({ region, regionNumber }) =>
            fetchFeaturesForRegion(region, regionNumber, bpPerPx, stopToken),
          )
          const results = await Promise.all(promises)
          if (isAlive(self) && self.fetchGeneration === generation) {
            applyFetchResults(results)
          }
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Failed to fetch features:', e)
            if (isAlive(self) && self.fetchGeneration === generation) {
              self.setError(e as Error)
            }
          }
        } finally {
          if (isAlive(self) && self.fetchGeneration === generation) {
            self.setRenderingStopToken(undefined)
            self.setLoading(false)
          }
        }
      }

      function refetchForCurrentView() {
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
        fetchRegions(regions, bpPerPx)
      }

      let prevDisplayedRegionsStr = ''
      let prevShowLabels: boolean | undefined
      let prevShowDescriptions: boolean | undefined
      let prevColorByCDS: boolean | undefined
      let prevGeneGlyphMode: string | undefined
      let prevShowOnlyGenes: boolean | undefined
      let prevSettingsInitialized = false

      return {
        reload() {
          refetchForCurrentView()
        },

        setFeatureDensityStatsLimit(_stats?: unknown) {
          self.userForceLoadLimit = self.featureCount + 1
        },

        afterAttach() {
          // Autorun: fetch data for all visible regions
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized || self.regionTooLarge) {
                  return
                }

                const bpPerPx = view.bpPerPx
                const needed: { region: Region; regionNumber: number }[] = []
                for (const vr of view.staticRegions) {
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
                  fetchRegions(needed, bpPerPx)
                }
              },
              {
                name: 'FetchVisibleRegions',
                delay: 300,
              },
            ),
          )

          // Autorun: re-layout when zoom changes significantly
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                if (view.initialized && self.needsLayoutRefresh) {
                  refetchForCurrentView()
                }
              },
              {
                name: 'ZoomLayoutRefresh',
                delay: 500,
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

          // Autorun: re-fetch when label/description/colorByCDS settings change
          addDisposer(
            self,
            autorun(
              () => {
                const showLabels = self.showLabels
                const showDescriptions = self.showDescriptions
                const colorByCDS = self.colorByCDS
                const geneGlyphMode = self.effectiveGeneGlyphMode
                const showOnlyGenes = self.showOnlyGenes
                if (
                  prevSettingsInitialized &&
                  (showLabels !== prevShowLabels ||
                    showDescriptions !== prevShowDescriptions ||
                    colorByCDS !== prevColorByCDS ||
                    geneGlyphMode !== prevGeneGlyphMode ||
                    showOnlyGenes !== prevShowOnlyGenes)
                ) {
                  if (self.loadedRegions.size > 0 || self.regionTooLarge) {
                    refetchForCurrentView()
                  }
                }
                prevSettingsInitialized = true
                prevShowLabels = showLabels
                prevShowDescriptions = showDescriptions
                prevColorByCDS = colorByCDS
                prevGeneGlyphMode = geneGlyphMode
                prevShowOnlyGenes = showOnlyGenes
              },
              {
                name: 'SettingsRefetch',
                delay: 100,
              },
            ),
          )

          // Autorun: clear data when displayedRegions identity changes
          addDisposer(
            self,
            autorun(
              () => {
                let regionStr = ''
                const view = getContainingView(self) as LGV
                regionStr = JSON.stringify(
                  view.displayedRegions.map(r => ({
                    refName: r.refName,
                    start: r.start,
                    end: r.end,
                  })),
                )
                if (
                  prevDisplayedRegionsStr !== '' &&
                  regionStr !== prevDisplayedRegionsStr
                ) {
                  self.clearAllRpcData()
                }
                prevDisplayedRegionsStr = regionStr
              },
              {
                name: 'DisplayedRegionsChange',
              },
            ),
          )
        },
      }
    })
    .views(self => ({
      contextMenuItems() {
        const feat = self.contextMenuFeature
        if (!feat) {
          return []
        }
        return [
          {
            label: 'Open feature details',
            onClick: () => {
              self.selectFeature(feat)
            },
          },
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
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      const {
        trackShowLabels,
        trackShowDescriptions,
        trackGeneGlyphMode,
        showOnlyGenes,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackShowLabels !== undefined && { trackShowLabels }),
        ...(trackShowDescriptions !== undefined && { trackShowDescriptions }),
        ...(trackGeneGlyphMode !== undefined && { trackGeneGlyphMode }),
        ...(showOnlyGenes && { showOnlyGenes }),
      } as typeof snap
    })
}

export type LinearWebGLFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLFeatureDisplayModel =
  Instance<LinearWebGLFeatureDisplayStateModel>
