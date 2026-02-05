import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
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
      rpcData: null as WebGLFeatureDataResult | null,
      loadedRegion: null as Region | null,
      layoutBpPerPx: null as number | null, // bpPerPx used for current layout
      isLoading: false,
      error: null as Error | null,
      currentDomainX: null as [number, number] | null,
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

      get visibleRegion() {
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return null
          }
          const blocks = view.dynamicBlocks.contentBlocks
          const first = blocks[0]
          if (!first) {
            return null
          }

          if (self.currentDomainX) {
            return {
              refName: first.refName,
              start: self.currentDomainX[0],
              end: self.currentDomainX[1],
              assemblyName: first.assemblyName,
            }
          }

          const last = blocks[blocks.length - 1]
          if (first.refName !== last?.refName) {
            return {
              refName: first.refName,
              start: first.start,
              end: first.end,
              assemblyName: first.assemblyName,
            }
          }

          const bpPerPx = view.bpPerPx
          const blockOffsetPx = first.offsetPx
          const deltaPx = view.offsetPx - blockOffsetPx
          const deltaBp = deltaPx * bpPerPx

          const viewportStart = first.start + deltaBp
          const viewportEnd = viewportStart + view.width * bpPerPx

          return {
            refName: first.refName,
            start: viewportStart,
            end: viewportEnd,
            assemblyName: first.assemblyName,
          }
        } catch {
          return null
        }
      },

      get isWithinLoadedRegion(): boolean {
        const visibleRegion = this.visibleRegion
        if (!self.loadedRegion || !visibleRegion) {
          return false
        }
        return (
          self.loadedRegion.refName === visibleRegion.refName &&
          visibleRegion.start >= self.loadedRegion.start &&
          visibleRegion.end <= self.loadedRegion.end
        )
      },

      get needsLayoutRefresh(): boolean {
        if (!self.layoutBpPerPx) {
          return false
        }
        try {
          const view = getContainingView(self) as LGV
          if (!view.initialized) {
            return false
          }
          // Re-layout if zoom changed by more than 2x in either direction
          const ratio = view.bpPerPx / self.layoutBpPerPx
          return ratio > 2 || ratio < 0.5
        } catch {
          return false
        }
      },

      getFeatureById(featureId: string): FlatbushItem | undefined {
        return self.rpcData?.flatbushItems.find(f => f.featureId === featureId)
      },

      get featureWidgetType() {
        return {
          type: 'BaseFeatureWidget',
          id: 'baseFeature',
        }
      },
    }))
    .actions(self => ({
      setRpcData(data: WebGLFeatureDataResult | null) {
        self.rpcData = data
        if (data) {
          self.maxY = data.maxY
        }
      },

      setLoadedRegion(region: Region | null) {
        self.loadedRegion = region
      },

      setLayoutBpPerPx(bpPerPx: number) {
        self.layoutBpPerPx = bpPerPx
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setMaxY(y: number) {
        self.maxY = y
      },

      setCurrentDomain(domainX: [number, number]) {
        self.currentDomainX = domainX
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
        // Create a SimpleFeature from the FlatbushItem for the context menu
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

        if (!self.loadedRegion) {
          return
        }

        // If clicking on a subfeature, we need to fetch the parent feature
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
              region: self.loadedRegion,
            },
          )) as { feature: Record<string, unknown> | undefined }

          if (result.feature && isAlive(self)) {
            const parentFeature = new SimpleFeature(
              result.feature as Parameters<typeof SimpleFeature.fromJSON>[0],
            )

            // If we clicked on a subfeature, find it within the parent
            if (subfeatureInfo) {
              const subfeature = findSubfeatureById(
                parentFeature,
                subfeatureInfo.featureId,
              )
              if (subfeature) {
                self.selectFeature(subfeature)
              } else {
                // Fallback to parent if subfeature not found
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
      async function fetchFeaturesImpl(region: Region, bpPerPx: number) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        self.setLoading(true)
        self.setError(null)

        try {
          const baseRendererConfig = getConf(self, 'renderer') || {}
          // Merge track-level overrides for showLabels and showDescriptions
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
            },
          )) as WebGLFeatureDataResult

          self.setRpcData(result)
          self.setLoadedRegion({
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
          self.setLayoutBpPerPx(bpPerPx)
          self.setLoading(false)
        } catch (e) {
          self.setError(e instanceof Error ? e : new Error(String(e)))
          self.setLoading(false)
        }
      }

      return {
        fetchFeatures(region: Region, bpPerPx: number) {
          fetchFeaturesImpl(region, bpPerPx).catch(e => {
            console.error('Failed to fetch features:', e)
          })
        },

        handleNeedMoreData(requestedRegion: { start: number; end: number }) {
          const visibleRegion = self.visibleRegion
          if (!visibleRegion) {
            return
          }

          const view = getContainingView(self) as LGV
          const bpPerPx = view?.bpPerPx ?? 1

          const width = requestedRegion.end - requestedRegion.start
          const expandedRegion = {
            refName: visibleRegion.refName,
            start: Math.max(0, requestedRegion.start - width),
            end: requestedRegion.end + width,
            assemblyName: visibleRegion.assemblyName,
          }

          fetchFeaturesImpl(expandedRegion, bpPerPx).catch(e => {
            console.error('Failed to fetch features:', e)
          })
        },

        afterAttach() {
          // React to region changes (panning)
          addDisposer(
            self,
            reaction(
              () => self.visibleRegion,
              region => {
                if (region && !self.isWithinLoadedRegion) {
                  const view = getContainingView(self) as LGV
                  const bpPerPx = view?.bpPerPx ?? 1
                  const width = region.end - region.start
                  const expandedRegion = {
                    ...region,
                    start: Math.max(0, region.start - width * 2),
                    end: region.end + width * 2,
                  }
                  fetchFeaturesImpl(expandedRegion, bpPerPx).catch(e => {
                    console.error('Failed to fetch features:', e)
                  })
                }
              },
              { delay: 300, fireImmediately: true },
            ),
          )

          // React to zoom changes (re-layout when zoom changes significantly)
          addDisposer(
            self,
            reaction(
              () => {
                try {
                  const view = getContainingView(self) as LGV
                  return view?.initialized ? view.bpPerPx : null
                } catch {
                  return null
                }
              },
              bpPerPx => {
                if (bpPerPx && self.needsLayoutRefresh && self.loadedRegion) {
                  const region = self.loadedRegion
                  fetchFeaturesImpl(region, bpPerPx).catch(e => {
                    console.error('Failed to refresh layout:', e)
                  })
                }
              },
              { delay: 500 }, // Debounce zoom changes
            ),
          )

          // React to label/description setting changes
          addDisposer(
            self,
            reaction(
              () => ({
                showLabels: self.showLabels,
                showDescriptions: self.showDescriptions,
              }),
              () => {
                if (self.loadedRegion) {
                  const view = getContainingView(self) as LGV
                  const bpPerPx = view?.bpPerPx ?? 1
                  fetchFeaturesImpl(self.loadedRegion, bpPerPx).catch(e => {
                    console.error(
                      'Failed to refresh after label settings change:',
                      e,
                    )
                  })
                }
              },
              { delay: 100 },
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
      const { trackShowLabels, trackShowDescriptions, ...rest } = snap as {
        trackShowLabels?: boolean
        trackShowDescriptions?: boolean
        [key: string]: unknown
      }
      return {
        ...rest,
        // Only persist if explicitly set (not undefined)
        ...(trackShowLabels !== undefined && { trackShowLabels }),
        ...(trackShowDescriptions !== undefined && { trackShowDescriptions }),
      }
    })
}

export type LinearWebGLFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLFeatureDisplayModel =
  Instance<LinearWebGLFeatureDisplayStateModel>
