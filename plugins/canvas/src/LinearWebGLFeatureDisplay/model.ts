import { lazy } from 'react'

import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { addDisposer, flow, isAlive, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { reaction } from 'mobx'

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
      BaseLinearDisplay,
      types.model('LinearWebGLFeatureDisplay', {
        type: types.literal('LinearWebGLFeatureDisplay'),
        configuration: ConfigurationReference(configSchema),
        trackShowLabels: types.maybe(types.boolean),
        trackShowDescriptions: types.maybe(types.boolean),
      }),
    )
    .volatile(() => ({
      rpcDataMap: new Map<number, WebGLFeatureDataResult>(),
      loadedRegions: new Map<number, Region>(),
      layoutBpPerPxMap: new Map<number, number>(),
      isLoading: false,
      error: null as Error | null,
      maxY: 0,
      featureIdUnderMouse: null as string | null,
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

      get visibleRegions() {
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return []
          }
          const blocks = view.dynamicBlocks.contentBlocks
          if (blocks.length === 0) {
            return []
          }

          const bpPerPx = view.bpPerPx
          const regions: {
            refName: string
            regionNumber: number
            start: number
            end: number
            assemblyName: string
            screenStartPx: number
            screenEndPx: number
          }[] = []

          for (const block of blocks) {
            const blockScreenStart = block.offsetPx - view.offsetPx
            const blockScreenEnd = blockScreenStart + block.widthPx

            const clippedScreenStart = Math.max(0, blockScreenStart)
            const clippedScreenEnd = Math.min(view.width, blockScreenEnd)
            if (clippedScreenStart >= clippedScreenEnd) {
              continue
            }

            const bpStart =
              block.start + (clippedScreenStart - blockScreenStart) * bpPerPx
            const bpEnd =
              block.start + (clippedScreenEnd - blockScreenStart) * bpPerPx

            const blockRegionNumber = block.regionNumber ?? 0

            const prev = regions[regions.length - 1]
            if (prev?.regionNumber === blockRegionNumber) {
              prev.end = bpEnd
              prev.screenEndPx = clippedScreenEnd
            } else {
              regions.push({
                refName: block.refName,
                regionNumber: blockRegionNumber,
                start: bpStart,
                end: bpEnd,
                assemblyName: block.assemblyName,
                screenStartPx: clippedScreenStart,
                screenEndPx: clippedScreenEnd,
              })
            }
          }
          return regions
        } catch {
          return []
        }
      },

      get isWithinLoadedRegions() {
        const visibleRegions = this.visibleRegions
        if (visibleRegions.length === 0) {
          return false
        }
        for (const vr of visibleRegions) {
          const loaded = self.loadedRegions.get(vr.regionNumber)
          if (
            loaded?.refName !== vr.refName ||
            vr.start < loaded.start ||
            vr.end > loaded.end
          ) {
            return false
          }
        }
        return true
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

      toggleShowLabels() {
        self.trackShowLabels = !self.showLabels
      },

      toggleShowDescriptions() {
        self.trackShowDescriptions = !self.showDescriptions
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
            const parentFeature = new SimpleFeature(
              result.feature as Parameters<typeof SimpleFeature.fromJSON>[0],
            )

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
          self.setError(e instanceof Error ? e : new Error(String(e)))
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

      return {
        afterAttach() {
          // Reaction: fetch data for all visible regions
          addDisposer(
            self,
            reaction(
              () => ({
                visibleRegions: self.visibleRegions,
                isWithinLoaded: self.isWithinLoadedRegions,
              }),
              ({ visibleRegions, isWithinLoaded }) => {
                if (visibleRegions.length > 0 && !isWithinLoaded) {
                  self.setLoading(true)
                  self.setError(null)

                  const view = getContainingView(self) as LGV
                  const bpPerPx = view.bpPerPx
                  const promises: Promise<void>[] = []

                  for (const vr of visibleRegions) {
                    const loaded = self.loadedRegions.get(vr.regionNumber)
                    if (
                      loaded?.refName === vr.refName &&
                      vr.start >= loaded.start &&
                      vr.end <= loaded.end
                    ) {
                      continue
                    }
                    const width = vr.end - vr.start
                    const expandedRegion = {
                      refName: vr.refName,
                      start: Math.max(0, vr.start - width * 2),
                      end: vr.end + width * 2,
                      assemblyName: vr.assemblyName,
                    }
                    promises.push(
                      fetchFeaturesForRegion(
                        expandedRegion,
                        vr.regionNumber,
                        bpPerPx,
                      ),
                    )
                  }

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
              { delay: 300, fireImmediately: true },
            ),
          )

          // Reaction: re-layout when zoom changes significantly
          addDisposer(
            self,
            reaction(
              () => {
                try {
                  const view = getContainingView(self) as LGV
                  return view.initialized ? view.bpPerPx : null
                } catch {
                  return null
                }
              },
              bpPerPx => {
                if (bpPerPx && self.needsLayoutRefresh) {
                  refetchAllLoadedRegions(bpPerPx)
                }
              },
              { delay: 500 },
            ),
          )

          // Reaction: re-fetch on label/description setting changes
          addDisposer(
            self,
            reaction(
              () => ({
                showLabels: self.showLabels,
                showDescriptions: self.showDescriptions,
              }),
              () => {
                if (self.loadedRegions.size > 0) {
                  const view = getContainingView(self) as LGV
                  refetchAllLoadedRegions(view.bpPerPx)
                }
              },
              { delay: 100 },
            ),
          )

          // Reaction: re-fetch on colorByCDS changes
          addDisposer(
            self,
            reaction(
              () => self.colorByCDS,
              () => {
                if (self.loadedRegions.size > 0) {
                  const view = getContainingView(self) as LGV
                  refetchAllLoadedRegions(view.bpPerPx)
                }
              },
              { delay: 100 },
            ),
          )

          // Reaction: clear data when displayedRegions identity changes
          addDisposer(
            self,
            reaction(
              () => {
                try {
                  const view = getContainingView(self) as LGV
                  return JSON.stringify(
                    view.displayedRegions.map(r => ({
                      refName: r.refName,
                      start: r.start,
                      end: r.end,
                    })),
                  )
                } catch {
                  return ''
                }
              },
              regionStr => {
                if (
                  prevDisplayedRegionsStr !== '' &&
                  regionStr !== prevDisplayedRegionsStr
                ) {
                  self.clearAllRpcData()
                }
                prevDisplayedRegionsStr = regionStr
              },
              { fireImmediately: true },
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
                  self.toggleShowLabels()
                },
              },
              {
                label: 'Show descriptions',
                type: 'checkbox',
                checked: self.showDescriptions,
                onClick: () => {
                  self.toggleShowDescriptions()
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
