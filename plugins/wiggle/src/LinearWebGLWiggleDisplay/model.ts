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
import PaletteIcon from '@mui/icons-material/Palette'
import { reaction } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { YSCALEBAR_LABEL_OFFSET, getNiceDomain, getScale } from '../util.ts'

import type { WebGLWiggleDataResult } from '../RenderWebGLWiggleDataRPC/types.ts'
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

const WebGLWiggleComponent = lazy(
  () => import('./components/WebGLWiggleComponent.tsx'),
)
const SetMinMaxDialog = lazy(() => import('../shared/SetMinMaxDialog.tsx'))
const SetColorDialog = lazy(
  () => import('../LinearWiggleDisplay/components/SetColorDialog.tsx'),
)

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      BaseLinearDisplay,
      types.model('LinearWebGLWiggleDisplay', {
        type: types.literal('LinearWebGLWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        colorSetting: types.maybe(types.string),
        posColorSetting: types.maybe(types.string),
        negColorSetting: types.maybe(types.string),
        scaleTypeSetting: types.maybe(types.string),
        minScoreSetting: types.maybe(types.number),
        maxScoreSetting: types.maybe(types.number),
        renderingTypeSetting: types.maybe(types.string),
      }),
    )
    .volatile(() => ({
      rpcDataMap: new Map<number, WebGLWiggleDataResult>(),
      loadedRegions: new Map<number, Region>(),
      isLoading: false,
      error: null as Error | null,
      currentBpRangeX: null as [number, number] | null,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WebGLWiggleComponent
      },

      renderProps() {
        return { notReady: true }
      },

      get color() {
        return self.colorSetting ?? getConf(self, 'color')
      },

      get posColor() {
        return self.posColorSetting ?? getConf(self, 'posColor')
      },

      get negColor() {
        return self.negColorSetting ?? getConf(self, 'negColor')
      },

      get bicolorPivot() {
        return getConf(self, 'bicolorPivot')
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

      get ticks() {
        const scaleType = this.scaleType
        const { height } = self
        const domain = this.domain
        if (!domain) {
          return undefined
        }
        const minimalTicks = getConf(self, 'minimalTicks')
        const ticks = axisPropsFromTickScale(
          getScale({
            scaleType,
            domain,
            range: [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET],
            inverted: false,
          }),
          4,
        )
        return height < 100 || minimalTicks
          ? { ...ticks, values: domain }
          : ticks
      },
    }))
    .actions(self => ({
      setRpcDataForRegion(regionNumber: number, data: WebGLWiggleDataResult) {
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

      setColor(color?: string) {
        self.colorSetting = color
      },

      setPosColor(color?: string) {
        self.posColorSetting = color
      },

      setNegColor(color?: string) {
        self.negColorSetting = color
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
            'RenderWebGLWiggleData',
            {
              sessionId: session.id,
              adapterConfig,
              region,
            },
          )) as WebGLWiggleDataResult

          self.setRpcDataForRegion(regionNumber, result)
          self.setLoadedRegionForRegion(regionNumber, {
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
        } catch (e) {
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
                      fetchFeaturesForRegion(expandedRegion, vr.regionNumber),
                    )
                  }

                  Promise.all(promises)
                    .then(() => {
                      self.setLoading(false)
                    })
                    .catch((e: unknown) => {
                      console.error('Failed to fetch wiggle features:', e)
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
                label: 'XY plot',
                type: 'radio',
                checked: self.renderingType === 'xyplot',
                onClick: () => {
                  self.setRenderingType('xyplot')
                },
              },
              {
                label: 'Density',
                type: 'radio',
                checked: self.renderingType === 'density',
                onClick: () => {
                  self.setRenderingType('density')
                },
              },
              {
                label: 'Line',
                type: 'radio',
                checked: self.renderingType === 'line',
                onClick: () => {
                  self.setRenderingType('line')
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
          {
            label: 'Color',
            icon: PaletteIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetColorDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
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
        colorSetting,
        posColorSetting,
        negColorSetting,
        scaleTypeSetting,
        minScoreSetting,
        maxScoreSetting,
        renderingTypeSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(colorSetting !== undefined ? { colorSetting } : {}),
        ...(posColorSetting !== undefined ? { posColorSetting } : {}),
        ...(negColorSetting !== undefined ? { negColorSetting } : {}),
        ...(scaleTypeSetting !== undefined ? { scaleTypeSetting } : {}),
        ...(minScoreSetting !== undefined ? { minScoreSetting } : {}),
        ...(maxScoreSetting !== undefined ? { maxScoreSetting } : {}),
        ...(renderingTypeSetting !== undefined ? { renderingTypeSetting } : {}),
      } as typeof snap
    })
}

export type LinearWebGLWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLWiggleDisplayModel =
  Instance<LinearWebGLWiggleDisplayStateModel>
