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
import { YSCALEBAR_LABEL_OFFSET, getNiceDomain, getScale } from '../util.ts'

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
        colorSetting: types.maybe(types.string),
        posColorSetting: types.maybe(types.string),
        negColorSetting: types.maybe(types.string),
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
      rpcDataMap: new Map<number, WebGLWiggleDataResult>(),
      visibleScoreRange: undefined as [number, number] | undefined,
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

      /**
       * #method
       * Returns adapter configuration. Can be overridden by subclasses to
       * provide custom adapter configs (e.g., GC content display)
       */
      adapterProps() {
        const track = getContainingTrack(self)
        return {
          adapterConfig: getConf(track, 'adapter'),
        }
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

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.visibleScoreRange = undefined
      },

      setVisibleScoreRange(range: [number, number]) {
        self.visibleScoreRange = range
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
        stopToken: string,
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
            stopToken,
          },
        )) as WebGLWiggleDataResult

        self.setRpcDataForRegion(regionNumber, result)
        self.setLoadedRegionForRegion(regionNumber, {
          refName: region.refName,
          start: region.start,
          end: region.end,
        })
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
            console.error('Failed to fetch wiggle features:', e)
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

          // Debounced autorun: compute visible score range from features
          // in the current viewport so the Y scale adjusts on pan/zoom
          addDisposer(
            self,
            autorun(
              () => {
                try {
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
                    for (let i = 0; i < data.numFeatures; i++) {
                      const fStart = data.featurePositions[i * 2]!
                      const fEnd = data.featurePositions[i * 2 + 1]!
                      if (fEnd > visStart && fStart < visEnd) {
                        const s = data.featureScores[i]!
                        if (s < min) {
                          min = s
                        }
                        if (s > max) {
                          max = s
                        }
                      }
                    }
                  }
                  if (Number.isFinite(min) && Number.isFinite(max)) {
                    self.setVisibleScoreRange([min, max])
                  }
                } catch {
                  // view not ready
                }
              },
              {
                delay: 400,
                name: 'LinearWiggleDisplay:visibleScoreRange',
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
