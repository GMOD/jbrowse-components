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
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

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
      rpcDataMap: new Map<number, WebGLMultiWiggleDataResult>(),
      loadedRegions: new Map<number, Region>(),
      isLoading: false,
      error: null as Error | null,
      currentBpRangeX: null as [number, number] | null,
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

      // backward-compat: returns first entry from rpcDataMap
      get rpcData() {
        const iter = self.rpcDataMap.values().next()
        return iter.done ? null : iter.value
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
            if (prev && prev.regionNumber === blockRegionNumber) {
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

          if (self.currentBpRangeX) {
            return {
              refName: first.refName,
              start: self.currentBpRangeX[0],
              end: self.currentBpRangeX[1],
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

          const totalWidthPx = Math.round(view.width)

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

      get isWithinLoadedRegions() {
        const visibleRegions = this.visibleRegions
        if (visibleRegions.length === 0) {
          return false
        }
        for (const vr of visibleRegions) {
          const loaded = self.loadedRegions.get(vr.regionNumber)
          if (
            !loaded ||
            loaded.refName !== vr.refName ||
            vr.start < loaded.start ||
            vr.end > loaded.end
          ) {
            return false
          }
        }
        return true
      },

      get domain(): [number, number] | undefined {
        if (self.rpcDataMap.size === 0) {
          return undefined
        }
        let globalMin = Infinity
        let globalMax = -Infinity
        for (const data of self.rpcDataMap.values()) {
          globalMin = Math.min(globalMin, data.scoreMin)
          globalMax = Math.max(globalMax, data.scoreMax)
        }
        const scaleType = this.scaleType

        return getNiceDomain({
          domain: [globalMin, globalMax],
          bounds: [this.minScoreConfig, this.maxScoreConfig],
          scaleType,
        })
      },

      get numSources() {
        const firstData = self.rpcDataMap.values().next()
        return firstData.done ? 0 : firstData.value.sources.length
      },

      get rowHeight() {
        const numSources = this.numSources
        if (numSources === 0) {
          return self.height
        }
        const totalPadding = 2 * (numSources - 1)
        return (self.height - totalPadding) / numSources
      },

      get rowHeightTooSmallForScalebar() {
        return this.rowHeight < 70
      },

      get ticks() {
        const scaleType = this.scaleType
        const domain = this.domain
        const rowHeight = this.rowHeight
        if (!domain) {
          return undefined
        }
        const minimalTicks = getConf(self, 'minimalTicks')
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
      setRpcDataForRegion(
        regionNumber: number,
        data: WebGLMultiWiggleDataResult,
      ) {
        const next = new Map(self.rpcDataMap)
        next.set(regionNumber, data)
        self.rpcDataMap = next
      },

      setLoadedRegionForRegion(regionNumber: number, region: Region) {
        const next = new Map(self.loadedRegions)
        next.set(regionNumber, region)
        self.loadedRegions = next
      },

      clearAllRpcData() {
        self.rpcDataMap = new Map()
        self.loadedRegions = new Map()
      },

      setLoading(loading: boolean) {
        self.isLoading = loading
      },

      setError(error: Error | null) {
        self.error = error
      },

      setCurrentBpRange(bpRangeX: [number, number]) {
        self.currentBpRangeX = bpRangeX
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
      async function fetchFeaturesForRegion(
        region: Region,
        regionNumber: number,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

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

          self.setRpcDataForRegion(regionNumber, result)
          self.setLoadedRegionForRegion(regionNumber, {
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
        } catch (e) {
          console.error('Failed to fetch multi-wiggle features:', e)
          self.setError(e instanceof Error ? e : new Error(String(e)))
        }
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

                  const promises: Promise<void>[] = []
                  for (const vr of visibleRegions) {
                    const loaded = self.loadedRegions.get(vr.regionNumber)
                    if (
                      loaded &&
                      loaded.refName === vr.refName &&
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
                      fetchFeaturesForRegion(expandedRegion, vr.regionNumber),
                    )
                  }

                  Promise.all(promises)
                    .then(() => {
                      self.setLoading(false)
                    })
                    .catch((e: unknown) => {
                      console.error('Failed to fetch multi-wiggle features:', e)
                      self.setLoading(false)
                    })
                }
              },
              { delay: 300, fireImmediately: true },
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
            label: 'Rendering type',
            subMenu: [
              {
                label: 'Multi-row XY plot',
                type: 'radio',
                checked: self.renderingType === 'multirowxy',
                onClick: () => {
                  self.setRenderingType('multirowxy')
                },
              },
              {
                label: 'Multi-row density',
                type: 'radio',
                checked: self.renderingType === 'multirowdensity',
                onClick: () => {
                  self.setRenderingType('multirowdensity')
                },
              },
              {
                label: 'Multi-row line',
                type: 'radio',
                checked: self.renderingType === 'multirowline',
                onClick: () => {
                  self.setRenderingType('multirowline')
                },
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
                onClick: () => {
                  self.setScaleType('linear')
                },
              },
              {
                label: 'Log scale',
                type: 'radio',
                checked: self.scaleType === 'log',
                onClick: () => {
                  self.setScaleType('log')
                },
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
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
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
