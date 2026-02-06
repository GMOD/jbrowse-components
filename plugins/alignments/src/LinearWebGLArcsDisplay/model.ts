import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { reaction } from 'mobx'

import type { WebGLArcsDataResult } from '../RenderWebGLArcsDataRPC/types.ts'
import type { ColorBy, FilterBy } from '../shared/types.ts'
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

const WebGLArcsComponent = lazy(
  () => import('./components/WebGLArcsComponent.tsx'),
)

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model('LinearWebGLArcsDisplay', {
        type: types.literal('LinearWebGLArcsDisplay'),
        configuration: ConfigurationReference(configSchema),
        colorBySetting: types.frozen<ColorBy | undefined>(),
        filterBySetting: types.frozen<FilterBy | undefined>(),
        lineWidthSetting: types.maybe(types.number),
        drawInter: types.optional(types.boolean, true),
        drawLongRange: types.optional(types.boolean, true),
      }),
    )
    .volatile(() => ({
      rpcData: null as WebGLArcsDataResult | null,
      loadedRegion: null as Region | null,
      isLoading: false,
      error: null as Error | null,
      currentDomainX: null as [number, number] | null,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WebGLArcsComponent
      },

      renderProps() {
        return { notReady: true }
      },

      get colorBy(): ColorBy {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },

      get filterBy(): FilterBy {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },

      get lineWidth(): number {
        return self.lineWidthSetting ?? getConf(self, 'lineWidth') ?? 1
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
    }))
    .actions(self => ({
      setRpcData(data: WebGLArcsDataResult | null) {
        self.rpcData = data
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

      setCurrentDomain(domainX: [number, number]) {
        self.currentDomainX = domainX
      },

      setColorScheme(colorBy: ColorBy) {
        self.colorBySetting = colorBy
      },

      setFilterBy(filterBy: FilterBy) {
        self.filterBySetting = filterBy
      },

      setLineWidth(width: number) {
        self.lineWidthSetting = width
      },

      setDrawInter(draw: boolean) {
        self.drawInter = draw
      },

      setDrawLongRange(draw: boolean) {
        self.drawLongRange = draw
      },
    }))
    .actions(self => {
      async function fetchFeaturesImpl(region: Region) {
        const session = getSession(self)
        const { rpcManager, assemblyManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        self.setLoading(true)
        self.setError(null)

        try {
          const assemblyName = region.assemblyName
          const assembly = assemblyName
            ? assemblyManager.get(assemblyName)
            : undefined
          const sequenceAdapterConfig =
            assembly?.configuration?.sequence?.adapter
          const sequenceAdapter = sequenceAdapterConfig
            ? getSnapshot(sequenceAdapterConfig)
            : undefined

          console.log(
            '[WebGLArcs model] fetching region:',
            region.refName,
            region.start,
            '-',
            region.end,
          )
          const result = (await rpcManager.call(
            session.id ?? '',
            'RenderWebGLArcsData',
            {
              sessionId: session.id,
              adapterConfig,
              sequenceAdapter,
              region,
              filterBy: self.filterBy,
              colorBy: self.colorBy,
              height: self.height,
              drawInter: self.drawInter,
              drawLongRange: self.drawLongRange,
            },
          )) as WebGLArcsDataResult

          console.log(
            '[WebGLArcs model] got RPC result: numArcs=',
            result.numArcs,
            'numLines=',
            result.numLines,
          )
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

          addDisposer(
            self,
            reaction(
              () => [
                self.filterBy,
                self.colorBy,
                self.drawInter,
                self.drawLongRange,
              ],
              () => {
                const visibleRegion = self.visibleRegion
                if (visibleRegion) {
                  fetchFeaturesImpl(visibleRegion).catch(e => {
                    console.error('Failed to fetch features:', e)
                  })
                }
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
            label: 'Color by...',
            subMenu: [
              {
                label: 'Insert size and orientation',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSizeAndOrientation' })
                },
              },
              {
                label: 'Orientation only',
                onClick: () => {
                  self.setColorScheme({ type: 'orientation' })
                },
              },
              {
                label: 'Insert size only',
                onClick: () => {
                  self.setColorScheme({ type: 'insertSize' })
                },
              },
              {
                label: 'Gradient',
                onClick: () => {
                  self.setColorScheme({ type: 'gradient' })
                },
              },
            ],
          },
          {
            label: 'Line width',
            subMenu: [
              {
                label: 'Thin',
                onClick: () => {
                  self.setLineWidth(1)
                },
              },
              {
                label: 'Bold',
                onClick: () => {
                  self.setLineWidth(2)
                },
              },
              {
                label: 'Extra bold',
                onClick: () => {
                  self.setLineWidth(5)
                },
              },
            ],
          },
          {
            label: 'Show...',
            subMenu: [
              {
                label: 'Inter-chromosomal connections',
                type: 'checkbox',
                checked: self.drawInter,
                onClick: () => {
                  self.setDrawInter(!self.drawInter)
                },
              },
              {
                label: 'Long range connections',
                type: 'checkbox',
                checked: self.drawLongRange,
                onClick: () => {
                  self.setDrawLongRange(!self.drawLongRange)
                },
              },
            ],
          },
        ]
      },
    }))
}

export type LinearWebGLArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLArcsDisplayModel =
  Instance<LinearWebGLArcsDisplayStateModel>
