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
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import { TrackHeightMixin } from '@jbrowse/plugin-linear-genome-view'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { autorun } from 'mobx'

import type {
  FlatbushItem,
  SubfeatureInfo,
  WebGLFeatureDataResult,
} from '../RenderWebGLFeatureDataRPC/types.ts'
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

interface Region {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

const WebGLFeatureComponent = lazy(
  () => import('./components/WebGLFeatureComponent.tsx'),
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
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplay snapshots
      const { blockState, showLegend, showTooltips, ...cleaned } = snap
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
      contextMenuFeature: undefined as Feature | undefined,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WebGLFeatureComponent
      },

      renderProps() {
        return { notReady: true }
      },

      get maxHeight(): number {
        return getConf(self, 'maxHeight') ?? 1200
      },

      get showLabels(): boolean {
        return self.trackShowLabels ?? getConf(self, ['renderer', 'showLabels'])
      },

      get showDescriptions(): boolean {
        return (
          self.trackShowDescriptions ??
          getConf(self, ['renderer', 'showDescriptions'])
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
        self.rpcDataMap = new Map()
        self.loadedRegions = new Map()
        self.layoutBpPerPxMap = new Map()
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setFeatureIdUnderMouse(featureId: string | null) {
        ;(self as any).featureIdUnderMouse = featureId
      },

      setContextMenuFeature(feature?: Feature) {
        self.contextMenuFeature = feature
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
      async function fetchFeaturesForRegion(
        region: Region,
        regionNumber: number,
        bpPerPx: number,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        try {
          const baseRendererConfig = getConf(self, 'renderer') || {}
          const rendererConfig = {
            ...baseRendererConfig,
            showLabels: self.showLabels,
            showDescriptions: self.showDescriptions,
          }
          const result = (await rpcManager.call(
            session.id ?? '',
            'RenderWebGLFeatureData',
            {
              sessionId: session.id,
              adapterConfig,
              rendererConfig,
              region,
              bpPerPx,
              colorByCDS: self.colorByCDS,
              sequenceAdapter: self.sequenceAdapter,
            },
          )) as WebGLFeatureDataResult

          self.setRpcDataForRegion(regionNumber, result)
          self.setLoadedRegionForRegion(regionNumber, {
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
          self.setLayoutBpPerPxForRegion(regionNumber, bpPerPx)
        } catch (e) {
          console.error(e)
          self.setError(e)
        }
      }

      function refetchAllLoadedRegions(bpPerPx: number) {
        self.setLoading(true)
        self.setError(null)
        const promises: Promise<void>[] = []
        for (const [regionNumber, region] of self.loadedRegions) {
          promises.push(fetchFeaturesForRegion(region, regionNumber, bpPerPx))
        }
        Promise.all(promises)
          .then(() => {
            self.setLoading(false)
          })
          .catch((e: unknown) => {
            console.error('Failed to refetch features:', e)
            self.setLoading(false)
          })
      }

      let prevDisplayedRegionsStr = ''
      let prevShowLabels: boolean | undefined
      let prevShowDescriptions: boolean | undefined
      let prevColorByCDS: boolean | undefined
      let prevSettingsInitialized = false

      return {
        afterAttach() {
          // Autorun: fetch data for all visible regions
          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LinearGenomeViewModel
                if (!view.initialized) {
                  return
                }
                const bpPerPx = view.bpPerPx
                const promises: Promise<void>[] = []
                for (const vr of view.staticRegions) {
                  const loaded = self.loadedRegions.get(vr.regionNumber)
                  if (
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end
                  ) {
                    continue
                  }
                  promises.push(
                    fetchFeaturesForRegion(
                      vr,
                      vr.regionNumber,
                      bpPerPx,
                    ),
                  )
                }
                if (promises.length > 0) {
                  self.setLoading(true)
                  self.setError(null)

                  Promise.all(promises)
                    .then(() => {
                      self.setLoading(false)
                    })
                    .catch((e: unknown) => {
                      console.error('Failed to fetch features:', e)
                      self.setLoading(false)
                    })
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
                  refetchAllLoadedRegions(view.bpPerPx)
                }
              },
              {
                name: 'ZoomLayoutRefresh',
                delay: 500,
              },
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
                if (
                  prevSettingsInitialized &&
                  (showLabels !== prevShowLabels ||
                    showDescriptions !== prevShowDescriptions ||
                    colorByCDS !== prevColorByCDS)
                ) {
                  if (self.loadedRegions.size > 0) {
                    const view = getContainingView(self) as LGV
                    refetchAllLoadedRegions(view.bpPerPx)
                  }
                }
                prevSettingsInitialized = true
                prevShowLabels = showLabels
                prevShowDescriptions = showDescriptions
                prevColorByCDS = colorByCDS
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
            ],
          },
        ]
      },
    }))
    .postProcessSnapshot(snap => {
      const { trackShowLabels, trackShowDescriptions, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >
      return {
        ...rest,
        // Only persist if explicitly set (not undefined)
        ...(trackShowLabels !== undefined && { trackShowLabels }),
        ...(trackShowDescriptions !== undefined && { trackShowDescriptions }),
      } as typeof snap
    })
}

export type LinearWebGLFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLFeatureDisplayModel =
  Instance<LinearWebGLFeatureDisplayStateModel>
