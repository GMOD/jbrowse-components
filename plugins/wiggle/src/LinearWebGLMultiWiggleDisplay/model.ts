import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
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
import {
  computeVisibleScoreRange,
  getNiceDomain,
  getScale,
} from '../util.ts'

import type { WebGLMultiWiggleDataResult } from '../RenderWebGLMultiWiggleDataRPC/types.ts'
import type { Source, SourceInfo } from '../util.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
  MultiRegionWebGLRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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
        resolution: types.optional(types.number, 1),
        layout: types.frozen([] as Source[]),
        scaleTypeSetting: types.maybe(types.string),
        minScoreSetting: types.maybe(types.number),
        maxScoreSetting: types.maybe(types.number),
        renderingTypeSetting: types.maybe(types.string),
        summaryScoreModeSetting: types.maybe(types.string),
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
      loadedBpPerPx: new Map<number, number>(),
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

      get hasResolution() {
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter') as { type: string }
        const { pluginManager } = getEnv(self)
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
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

      get summaryScoreMode() {
        return self.summaryScoreModeSetting ?? getConf(self, 'summaryScoreMode')
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

      setVisibleScoreRange(range: [number, number]) {
        self.visibleScoreRange = range
      },

      setLoadedBpPerPxForRegion(regionNumber: number, bpPerPx: number) {
        const next = new Map(self.loadedBpPerPx)
        next.set(regionNumber, bpPerPx)
        self.loadedBpPerPx = next
      },

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.visibleScoreRange = undefined
        self.loadedBpPerPx = new Map()
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

      setSummaryScoreMode(val: string) {
        self.summaryScoreModeSetting = val
      },

      setResolution(res: number) {
        self.resolution = res
      },
    }))
    .actions(self => {
      async function fetchFeaturesForRegion(
        region: Region,
        regionNumber: number,
        stopToken: string,
        bpPerPx: number,
        resolution: number,
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
            bicolorPivot: self.bicolorPivot,
            stopToken,
            bpPerPx,
            resolution,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )) as WebGLMultiWiggleDataResult

        if (isAlive(self)) {
          self.setRpcDataForRegion(regionNumber, result)
          self.setLoadedRegionForRegion(regionNumber, {
            refName: region.refName,
            start: region.start,
            end: region.end,
          })
          self.setLoadedBpPerPxForRegion(regionNumber, bpPerPx)
        }
      }

      async function fetchRegions(
        regions: { region: Region; regionNumber: number }[],
        bpPerPx: number,
        resolution: number,
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
            fetchFeaturesForRegion(
              region,
              regionNumber,
              stopToken,
              bpPerPx,
              resolution,
            ),
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
            self.setStatusMessage(undefined)
          }
        }
      }

      const superAfterAttach = self.afterAttach

      let prevPivot: number | undefined
      let prevResolution: number | undefined

      return {
        afterAttach() {
          superAfterAttach()

          addDisposer(
            self,
            autorun(
              () => {
                const pivot = self.bicolorPivot
                if (prevPivot !== undefined && pivot !== prevPivot) {
                  self.clearAllRpcData()
                }
                prevPivot = pivot
              },
              { name: 'BicolorPivotChange' },
            ),
          )

          addDisposer(
            self,
            autorun(
              () => {
                const { resolution } = self
                if (
                  prevResolution !== undefined &&
                  resolution !== prevResolution
                ) {
                  self.clearAllRpcData()
                }
                prevResolution = resolution
              },
              { name: 'ResolutionChange' },
            ),
          )

          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const entries = view.dynamicBlocks.contentBlocks
                  .filter(block => block.regionNumber !== undefined)
                  .flatMap(block => {
                    const regionData = self.rpcDataMap.get(block.regionNumber!)
                    if (!regionData) {
                      return []
                    }
                    const visStart = block.start - regionData.regionStart
                    const visEnd = block.end - regionData.regionStart
                    return regionData.sources.map(source => ({
                      visStart,
                      visEnd,
                      data: source,
                    }))
                  })
                const range = computeVisibleScoreRange(
                  self.summaryScoreMode,
                  entries,
                )
                if (range) {
                  self.setVisibleScoreRange(range)
                }
              },
              { delay: 400, name: 'VisibleScoreRange' },
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
                const { bpPerPx } = view
                const { resolution } = self
                const needed: { region: Region; regionNumber: number }[] = []
                for (const vr of view.staticRegions) {
                  const loaded = self.loadedRegions.get(vr.regionNumber)
                  const loadedBpPerPx = self.loadedBpPerPx.get(vr.regionNumber)
                  if (
                    loaded?.refName === vr.refName &&
                    vr.start >= loaded.start &&
                    vr.end <= loaded.end &&
                    (loadedBpPerPx === undefined ||
                      bpPerPx >= loadedBpPerPx / 2)
                  ) {
                    continue
                  }
                  needed.push({
                    region: vr as Region,
                    regionNumber: vr.regionNumber,
                  })
                }
                if (needed.length > 0) {
                  await fetchRegions(needed, bpPerPx, resolution)
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
              {
                label: 'Multi-row scatter',
                type: 'radio',
                checked: self.renderingType === 'multirowscatter',
                onClick: () => {
                  self.setRenderingType('multirowscatter')
                },
              },
            ],
          },
          ...(self.hasResolution
            ? [
                {
                  label: 'Resolution',
                  subMenu: [
                    {
                      label: 'Finer resolution',
                      onClick: () => {
                        self.setResolution(self.resolution * 5)
                      },
                    },
                    {
                      label: 'Coarser resolution',
                      onClick: () => {
                        self.setResolution(self.resolution / 5)
                      },
                    },
                  ],
                },
                {
                  label: 'Summary score mode',
                  subMenu: (['min', 'max', 'avg', 'whiskers'] as const).map(
                    elt => ({
                      label: elt,
                      type: 'radio' as const,
                      checked: self.summaryScoreMode === elt,
                      onClick: () => {
                        self.setSummaryScoreMode(elt)
                      },
                    }),
                  ),
                },
              ]
            : []),
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
        summaryScoreModeSetting,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(layout.length > 0 ? { layout } : {}),
        ...(scaleTypeSetting !== undefined ? { scaleTypeSetting } : {}),
        ...(minScoreSetting !== undefined ? { minScoreSetting } : {}),
        ...(maxScoreSetting !== undefined ? { maxScoreSetting } : {}),
        ...(renderingTypeSetting !== undefined ? { renderingTypeSetting } : {}),
        ...(summaryScoreModeSetting !== undefined ? { summaryScoreModeSetting } : {}),
      } as typeof snap
    })
}

export type LinearWebGLMultiWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLMultiWiggleDisplayModel =
  Instance<LinearWebGLMultiWiggleDisplayStateModel>
