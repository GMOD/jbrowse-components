import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import { reaction } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { getNiceDomain, getScale } from '../util.ts'

import type { WebGLMultiWiggleDataResult } from '../RenderWebGLMultiWiggleDataRPC/types.ts'
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

interface SourceInfo {
  name: string
  color?: string
}

const WebGLMultiWiggleComponent = lazy(
  () => import('./components/WebGLMultiWiggleComponent.tsx'),
)
const SetMinMaxDialog = lazy(() => import('../shared/SetMinMaxDialog.tsx'))

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model('LinearWebGLMultiWiggleDisplay', {
        type: types.literal('LinearWebGLMultiWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        scaleTypeSetting: types.maybe(types.string),
        minScoreSetting: types.maybe(types.number),
        maxScoreSetting: types.maybe(types.number),
        renderingTypeSetting: types.maybe(types.string),
      }),
    )
    .volatile(() => ({
      rpcData: null as WebGLMultiWiggleDataResult | null,
      loadedRegion: null as Region | null,
      isLoading: false,
      error: null as Error | null,
      currentDomainX: null as [number, number] | null,
      sources: [] as SourceInfo[],
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WebGLMultiWiggleComponent
      },

      renderProps() {
        return { notReady: true }
      },

      get scaleType() {
        return self.scaleTypeSetting ?? getConf(self, 'scaleType')
      },

      get renderingType() {
        return self.renderingTypeSetting ?? getConf(self, 'defaultRendering')
      },

      get minScore() {
        return self.minScoreSetting ?? getConf(self, 'minScore')
      },

      get maxScore() {
        return self.maxScoreSetting ?? getConf(self, 'maxScore')
      },

      get minScoreConfig() {
        const val = this.minScore
        return val === Number.MIN_VALUE ? undefined : val
      },

      get maxScoreConfig() {
        const val = this.maxScore
        return val === Number.MAX_VALUE ? undefined : val
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

          // Canvas spans full width - labels overlay it with transparency
          const totalWidthPx = Math.round(view.dynamicBlocks.totalWidthPx)

          const viewportStart = first.start + deltaBp
          const viewportEnd = viewportStart + totalWidthPx * bpPerPx

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

      get isWithinLoadedRegion() {
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

      get domain(): [number, number] | undefined {
        if (!self.rpcData) {
          return undefined
        }
        const { scoreMin, scoreMax } = self.rpcData
        const { scaleType } = self

        // Use getNiceDomain to snap to 0 for linear scale (matches MultiLinearWiggleDisplay)
        return getNiceDomain({
          domain: [scoreMin, scoreMax],
          bounds: [this.minScoreConfig, this.maxScoreConfig],
          scaleType,
        })
      },

      get numSources() {
        return self.rpcData?.sources.length ?? 0
      },

      get rowHeight() {
        const numSources = this.numSources
        if (numSources === 0) {
          return self.height
        }
        // Account for padding between rows (ROW_PADDING = 2)
        const totalPadding = 2 * (numSources - 1)
        return (self.height - totalPadding) / numSources
      },

      get rowHeightTooSmallForScalebar() {
        return this.rowHeight < 70
      },

      get ticks() {
        const { scaleType } = self
        const domain = this.domain
        const rowHeight = this.rowHeight
        if (!domain) {
          return undefined
        }
        const minimalTicks = getConf(self, 'minimalTicks')
        // For multi-row displays, use no offset (range goes from rowHeight to 0)
        const ticks = axisPropsFromTickScale(
          getScale({
            scaleType,
            domain,
            range: [rowHeight, 0],
            inverted: false,
          }),
          4,
        )
        return rowHeight < 100 || minimalTicks
          ? { ...ticks, values: domain }
          : ticks
      },
    }))
    .actions(self => ({
      setRpcData(data: WebGLMultiWiggleDataResult | null) {
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

      setSources(sources: SourceInfo[]) {
        self.sources = sources
      },

      setScaleType(scaleType: string) {
        self.scaleTypeSetting = scaleType
      },

      setMinScore(val?: number) {
        self.minScoreSetting = val
      },

      setMaxScore(val?: number) {
        self.maxScoreSetting = val
      },

      setRenderingType(type: string) {
        self.renderingTypeSetting = type
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
          const result = (await rpcManager.call(
            session.id ?? '',
            'RenderWebGLMultiWiggleData',
            {
              sessionId: session.id,
              adapterConfig,
              region,
              sources: self.sources,
            },
          )) as WebGLMultiWiggleDataResult

          self.setRpcData(result)
          self.setLoadedRegion({
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
          self.setLoading(false)
        } catch (e) {
          console.error('Failed to fetch multi-wiggle features:', e)
          self.setError(e instanceof Error ? e : new Error(String(e)))
          self.setLoading(false)
        }
      }

      return {
        fetchFeatures(region: Region) {
          fetchFeaturesImpl(region).catch(e => {
            console.error('Failed to fetch multi-wiggle features:', e)
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
                    console.error('Failed to fetch multi-wiggle features:', e)
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
        return [
          {
            label: 'Rendering type',
            subMenu: [
              {
                label: 'Multi-row XY plot',
                type: 'radio',
                checked: self.renderingType === 'multirowxy',
                onClick: () => self.setRenderingType('multirowxy'),
              },
              {
                label: 'Multi-row density',
                type: 'radio',
                checked: self.renderingType === 'multirowdensity',
                onClick: () => self.setRenderingType('multirowdensity'),
              },
              {
                label: 'Multi-row line',
                type: 'radio',
                checked: self.renderingType === 'multirowline',
                onClick: () => self.setRenderingType('multirowline'),
              },
            ],
          },
          {
            label: 'Score',
            icon: EqualizerIcon,
            subMenu: [
              {
                label: 'Linear scale',
                type: 'radio',
                checked: self.scaleType === 'linear',
                onClick: () => self.setScaleType('linear'),
              },
              {
                label: 'Log scale',
                type: 'radio',
                checked: self.scaleType === 'log',
                onClick: () => self.setScaleType('log'),
              },
              {
                label: 'Set min/max score',
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    SetMinMaxDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
            ],
          },
        ]
      },
    }))
    .actions(self => ({
      async renderSvg() {
        console.log('multi model renderSvg action called')
        const { renderSvg } = await import('./renderSvg.tsx')
        console.log('multi model renderSvg import complete')
        const result = await renderSvg(self)
        console.log('multi model renderSvg function complete')
        return result
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        scaleTypeSetting,
        minScoreSetting,
        maxScoreSetting,
        renderingTypeSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(scaleTypeSetting !== undefined ? { scaleTypeSetting } : {}),
        ...(minScoreSetting !== undefined ? { minScoreSetting } : {}),
        ...(maxScoreSetting !== undefined ? { maxScoreSetting } : {}),
        ...(renderingTypeSetting !== undefined ? { renderingTypeSetting } : {}),
      } as typeof snap
    })
}

export type LinearWebGLMultiWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLMultiWiggleDisplayModel =
  Instance<LinearWebGLMultiWiggleDisplayStateModel>
