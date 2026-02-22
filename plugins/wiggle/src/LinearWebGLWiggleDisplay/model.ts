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
  WIGGLE_COLOR_DEFAULT,
  YSCALEBAR_LABEL_OFFSET,
  computeVisibleScoreRange,
  getNiceDomain,
  getScale,
} from '../util.ts'

import type { WebGLWiggleDataResult } from '../RenderWebGLWiggleDataRPC/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
  MultiRegionWebGLRegion as Region,
} from '@jbrowse/plugin-linear-genome-view'

export type { MultiRegionWebGLRegion as Region } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const WebGLWiggleComponent = lazy(
  () => import('./components/WebGLWiggleComponent.tsx'),
)
const SetMinMaxDialog = lazy(() => import('../shared/SetMinMaxDialog.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

export default function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionWebGLDisplayMixin(),
      types.model({
        type: types.literal('LinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        resolution: types.optional(types.number, 1),
        colorSetting: types.maybe(types.string),
        posColorSetting: types.maybe(types.string),
        negColorSetting: types.maybe(types.string),
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
      rpcDataMap: new Map<number, WebGLWiggleDataResult>(),
      visibleScoreRange: undefined as [number, number] | undefined,
      loadedBpPerPx: new Map<number, number>(),
      featureUnderMouse: undefined as
        | {
            refName: string
            start: number
            end: number
            score: number
            minScore?: number
            maxScore?: number
            summary?: boolean
          }
        | undefined,
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

      get effectiveBicolorPivot() {
        const c = this.color
        const useBicolor = c === WIGGLE_COLOR_DEFAULT || c === '#ff00ff'
        return useBicolor ? this.bicolorPivot : -Infinity
      },

      get scaleType() {
        return self.scaleTypeSetting ?? getConf(self, 'scaleType')
      },

      /**
       * #method
       * Returns adapter configuration. Can be overridden by subclasses to
       * provide custom adapter configs (e.g., GC content display)
       */
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

      adapterProps() {
        const track = getContainingTrack(self)
        return {
          adapterConfig: getConf(track, 'adapter'),
        }
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

      setSummaryScoreMode(val: string) {
        self.summaryScoreModeSetting = val
      },

      setResolution(res: number) {
        self.resolution = res
      },

      setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
        self.featureUnderMouse = feat
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
        const { adapterConfig } = self.adapterProps()

        if (!adapterConfig) {
          return
        }

        const result = (await rpcManager.call(
          session.id ?? '',
          'RenderWebGLWiggleData',
          {
            sessionId: session.id,
            adapterConfig,
            region,
            bicolorPivot: self.effectiveBicolorPivot,
            stopToken,
            bpPerPx,
            resolution,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )) as WebGLWiggleDataResult

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
            console.error('Failed to fetch wiggle features:', e)
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
                const pivot = self.effectiveBicolorPivot
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
                  .map(block => {
                    const data = self.rpcDataMap.get(block.regionNumber!)
                    return data
                      ? {
                          visStart: block.start - data.regionStart,
                          visEnd: block.end - data.regionStart,
                          data,
                        }
                      : undefined
                  })
                  .filter((e): e is NonNullable<typeof e> => !!e)
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
              {
                label: 'Scatter',
                type: 'radio',
                checked: self.renderingType === 'scatter',
                onClick: () => {
                  self.setRenderingType('scatter')
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
        return renderSvg(self as LinearWebGLWiggleDisplayModel, opts)
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
        summaryScoreModeSetting,
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
        ...(summaryScoreModeSetting !== undefined ? { summaryScoreModeSetting } : {}),
      } as typeof snap
    })
}

export type LinearWebGLWiggleDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearWebGLWiggleDisplayModel =
  Instance<LinearWebGLWiggleDisplayStateModel>
