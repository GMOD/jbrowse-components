import { lazy } from 'react'

console.log('LinearWebGLFeatureDisplay model module loaded')

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { reaction } from 'mobx'

import type {
  FlatbushItem,
  WebGLFeatureDataResult,
} from '../RenderWebGLFeatureDataRPC/types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
      }),
    )
    .volatile(() => ({
      rpcData: null as WebGLFeatureDataResult | null,
      loadedRegion: null as Region | null,
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
          if (!last || first.refName !== last.refName) {
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

      getFeatureById(featureId: string): FlatbushItem | undefined {
        return self.rpcData?.flatbushItems.find(f => f.featureId === featureId)
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
        self.featureIdUnderMouse = featureId
      },

      selectFeature(featureInfo: FlatbushItem) {
        // Use the session's selection mechanism (same as base class)
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
        getSession(self).setSelection(feature)
      },

      clearSelection() {
        getSession(self).clearSelection()
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
    .actions(self => {
      async function fetchFeaturesImpl(region: Region) {
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
          const rendererConfig = getConf(self, 'renderer')
          console.log('LinearWebGLFeatureDisplay: Calling RPC', { region })
          const result = (await rpcManager.call(
            session.id ?? '',
            'RenderWebGLFeatureData',
            {
              sessionId: session.id,
              adapterConfig,
              rendererConfig,
              region,
            },
          )) as WebGLFeatureDataResult

          console.log('LinearWebGLFeatureDisplay: RPC result received', {
            numRects: result.numRects,
            numLines: result.numLines,
          })
          self.setRpcData(result)
          self.setLoadedRegion({
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
          self.setLoading(false)
        } catch (e) {
          self.setError(e instanceof Error ? e : new Error(String(e)))
          self.setLoading(false)
        }
      }

      return {
        fetchFeatures(region: Region) {
          fetchFeaturesImpl(region).catch(e => {
            console.error('Failed to fetch features:', e)
          })
        },

        handleNeedMoreData(requestedRegion: { start: number; end: number }) {
          const visibleRegion = self.visibleRegion
          if (!visibleRegion) {
            return
          }

          const width = requestedRegion.end - requestedRegion.start
          const expandedRegion = {
            refName: visibleRegion.refName,
            start: Math.max(0, requestedRegion.start - width),
            end: requestedRegion.end + width,
            assemblyName: visibleRegion.assemblyName,
          }

          fetchFeaturesImpl(expandedRegion).catch(e => {
            console.error('Failed to fetch features:', e)
          })
        },

        afterAttach() {
          addDisposer(
            self,
            reaction(
              () => self.visibleRegion,
              region => {
                if (region && !self.isWithinLoadedRegion) {
                  const width = region.end - region.start
                  const expandedRegion = {
                    ...region,
                    start: Math.max(0, region.start - width * 2),
                    end: region.end + width * 2,
                  }
                  fetchFeaturesImpl(expandedRegion).catch(e => {
                    console.error('Failed to fetch features:', e)
                  })
                }
              },
              { delay: 300, fireImmediately: true },
            ),
          )
        },
      }
    })
    .views(self => ({
      trackMenuItems() {
        return []
      },
    }))
}

export type LinearWebGLFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLFeatureDisplayModel =
  Instance<LinearWebGLFeatureDisplayStateModel>
