import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionWebGLDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import { autorun } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { getNiceDomain, getScale } from '../util.ts'

import type { WebGLMultiWiggleDataResult } from '../RenderWebGLMultiWiggleDataRPC/types.ts'
import type { Source } from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
  MultiRegionWebGLRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface SourceInfo {
  name: string
  color?: string
}

const WebGLMultiWiggleComponent = lazy(
  () => import('./components/WebGLMultiWiggleComponent.tsx'),
)
const SetMinMaxDialog = lazy(() => import('../shared/SetMinMaxDialog.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'MultiLinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionWebGLDisplayMixin(),
      types.model({
        type: types.literal('MultiLinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        layout: types.frozen([] as Source[]),
        scaleTypeSetting: types.maybe(types.string),
        minScoreSetting: types.maybe(types.number),
        maxScoreSetting: types.maybe(types.number),
        renderingTypeSetting: types.maybe(types.string),
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
      rpcDataMap: new Map<number, WebGLMultiWiggleDataResult>(),
      sourcesVolatile: [] as SourceInfo[],
      visibleScoreRange: undefined as [number, number] | undefined,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return WebGLMultiWiggleComponent
      },

      renderProps() {
        return { notReady: true }
      },

      get sources(): Source[] {
        const sourceMap = Object.fromEntries(
          self.sourcesVolatile.map(s => [s.name, s]),
        )
        const iter = self.layout.length ? self.layout : self.sourcesVolatile
        return iter.map(s => ({
          source: s.name,
          ...sourceMap[s.name],
          ...s,
        }))
      },

      get posColor() {
        return getConf(self, 'posColor') as string
      },

      get negColor() {
        return getConf(self, 'negColor') as string
      },

      get bicolorPivot() {
        return getConf(self, 'bicolorPivot') as number
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

      get domain(): [number, number] | undefined {
        if (self.rpcDataMap.size === 0) {
          return undefined
        }
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        const scaleType = this.scaleType
        return getNiceDomain({
          domain: range,
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
        if (self.sourcesVolatile.length === 0 && data.sources.length > 0) {
          self.sourcesVolatile = data.sources.map(s => ({
            name: s.name,
            color: s.color,
          }))
        }
      },

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.visibleScoreRange = undefined
      },

      setVisibleScoreRange(range: [number, number]) {
        self.visibleScoreRange = range
      },

      setSources(sources: SourceInfo[]) {
        self.sourcesVolatile = sources
      },

      setLayout(layout: Source[]) {
        self.layout = layout
      },

      clearLayout() {
        self.layout = []
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
        stopToken: string,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter')

        if (!adapterConfig) {
          return
        }

        const result = (await rpcManager.call(
          session.id ?? '',
          'RenderWebGLMultiWiggleData',
          {
            sessionId: session.id,
            adapterConfig,
            region,
            sources: self.sources,
            stopToken,
          },
        )) as WebGLMultiWiggleDataResult

        if (isAlive(self)) {
          self.setRpcDataForRegion(regionNumber, result)
          self.setLoadedRegionForRegion(regionNumber, {
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
        }
      }

      async function fetchRegions(
        regions: { region: Region; regionNumber: number }[],
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
            fetchFeaturesForRegion(region, regionNumber, stopToken),
          )
          await Promise.all(promises)
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Failed to fetch multi-wiggle features:', e)
            if (isAlive(self) && self.fetchGeneration === generation) {
              self.setError(e instanceof Error ? e : new Error(String(e)))
            }
          }
        } finally {
          if (isAlive(self) && self.fetchGeneration === generation) {
            self.setRenderingStopToken(undefined)
            self.setLoading(false)
          }
        }
      }

      const superAfterAttach = self.afterAttach

      return {
        afterAttach() {
          superAfterAttach()

          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const blocks = view.dynamicBlocks.contentBlocks
                let min = Infinity
                let max = -Infinity
                for (const block of blocks) {
                  if (block.regionNumber === undefined) {
                    continue
                  }
                  const data = self.rpcDataMap.get(block.regionNumber)
                  if (!data) {
                    continue
                  }
                  const visStart = block.start - data.regionStart
                  const visEnd = block.end - data.regionStart
                  for (const source of data.sources) {
                    for (let i = 0; i < source.numFeatures; i++) {
                      const fStart = source.featurePositions[i * 2]!
                      const fEnd = source.featurePositions[i * 2 + 1]!
                      if (fEnd > visStart && fStart < visEnd) {
                        const s = source.featureScores[i]!
                        if (s < min) {
                          min = s
                        }
                        if (s > max) {
                          max = s
                        }
                      }
                    }
                  }
                }
                if (Number.isFinite(min) && Number.isFinite(max)) {
                  self.setVisibleScoreRange([min, max])
                }
              },
              {
                delay: 400,
                name: 'MultiWiggleDisplay:visibleScoreRange',
              },
            ),
          )

          addDisposer(
            self,
            autorun(
              async () => {
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
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
                  await fetchRegions(needed)
                }
              },
              {
                name: 'FetchVisibleRegions',
                delay: 500,
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
            label: 'Edit colors/arrangement...',
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
        return renderSvg(self as LinearWebGLMultiWiggleDisplayModel, opts)
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        layout,
        scaleTypeSetting,
        minScoreSetting,
        maxScoreSetting,
        renderingTypeSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(layout.length > 0 ? { layout } : {}),
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
