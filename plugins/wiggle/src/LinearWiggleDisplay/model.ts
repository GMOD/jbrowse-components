import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import { observable } from 'mobx'

import { buildSourceRenderData } from './components/buildSourceRenderData.ts'
import { WiggleCommonMixin } from '../shared/WiggleCommonMixin.ts'
import { installPerRegionWiggleLifecycle } from '../shared/installPerRegionWiggleLifecycle.ts'
import { makeWigglePreProcessSnapshot } from '../shared/makeWigglePreProcessSnapshot.ts'
import { makeRenderState } from '../shared/wiggleComponentUtils.ts'
import {
  makeAutoscaleTypeSubMenu,
  makeResolutionAndSummarySubMenus,
  makeScaleTypeSubMenu,
} from '../shared/wiggleMenuItems.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeAutoscaleDomain,
  getNiceDomain,
  getScale,
  isDefaultBicolor,
} from '../util.ts'

import type { WiggleDataResult } from '../RenderWiggleDataRPC/types.ts'
import type { WiggleBackend } from '../shared/wiggleBackendTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export type { Region } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const WiggleComponent = lazy(() => import('./components/WiggleComponent.tsx'))
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
      MultiRegionDisplayMixin(),
      WiggleCommonMixin(),
      types.model({
        type: types.literal('LinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .preProcessSnapshot(
      // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
      // return type against the model creation type
      makeWigglePreProcessSnapshot(),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, WiggleDataResult>(),
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
        return WiggleComponent
      },

      get color() {
        return self.getConfWithOverride<string>('color')
      },

      get adapterConfig() {
        return getConf(getContainingTrack(self), 'adapter')
      },

      get isDensityMode() {
        return self.renderingType === 'density'
      },
    }))
    .views(self => ({
      get effectiveBicolorPivot() {
        return isDefaultBicolor(self.color) ? self.bicolorPivot : -Infinity
      },

      get hasResolution() {
        const adapterConfig = self.adapterConfig as { type: string }
        const { pluginManager } = getEnv(self)
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
      },

      get visibleScoreRange() {
        const view = getContainingView(self) as LGV
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return undefined
        }
        const numStdDev = self.getConfWithOverride<number>('numStdDev')
        // Use coarseDynamicBlocks (500ms debounced) instead of visibleRegions
        // so autoscale doesn't recompute on every animation frame during zoom.
        const visibleEntries = view.coarseDynamicBlocks.flatMap(block => {
          const data = self.rpcDataMap.get(block.displayedRegionIndex!)
          if (!data) {
            return []
          }
          return [
            {
              visStart: Math.floor(block.start),
              visEnd: Math.ceil(block.end),
              data,
            },
          ]
        })
        const allEntries = [...self.rpcDataMap.values()].map(data => ({
          data,
        }))
        return computeAutoscaleDomain(
          self.autoscaleType,
          self.summaryScoreMode,
          numStdDev,
          visibleEntries,
          allEntries,
        )
      },
    }))
    .views(self => ({
      get domain() {
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreConfig, self.maxScoreConfig],
          scaleType: self.scaleType,
        })
      },
    }))
    .views(self => ({
      get ticks() {
        const { height } = self
        const domain = self.domain
        if (!domain) {
          return undefined
        }
        const scale = getScale({
          scaleType: self.scaleType,
          domain,
          range: [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET],
          inverted: false,
        })
        const minimalTicks = self.getConfWithOverride<boolean>('minimalTicks')
        const values =
          height < 100 || minimalTicks ? (domain as number[]) : scale.ticks(4)
        return {
          ticks: values.map(v => ({ value: v, y: scale(v) })),
          yTop: YSCALEBAR_LABEL_OFFSET,
          yBottom: height - YSCALEBAR_LABEL_OFFSET,
        }
      },

      get renderState() {
        const domain = self.domain
        if (!domain) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        return makeRenderState(
          domain,
          self.scaleType,
          self.renderingType,
          view.trackWidthPx,
          self.height,
        )
      },

      rpcProps() {
        return {
          bicolorPivot: self.effectiveBicolorPivot,
          resolution: self.resolution,
        }
      },

      gpuProps() {
        return {
          color: self.color,
          posColor: self.posColor,
          negColor: self.negColor,
          summaryScoreMode: self.summaryScoreMode,
          isDensityMode: self.isDensityMode,
          renderingType: self.renderingType,
        }
      },
    }))
    .actions(self => ({
      setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
        self.rpcDataMap.set(displayedRegionIndex, data)
      },

      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.setLoadedBpPerPx(undefined)
      },

      reload() {
        self.clearAllRpcData()
      },

      setColor(color?: string) {
        self.setOverride('color', color)
      },

      setPosColor(color?: string) {
        self.setOverride('posColor', color)
      },

      setNegColor(color?: string) {
        self.setOverride('negColor', color)
      },

      setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
        self.featureUnderMouse = feat
      },
    }))
    .actions(self => ({
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const view = getContainingView(self) as LGV
        const { adapterConfig } = self
        if (!adapterConfig) {
          return
        }
        const { bpPerPx } = view
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        await self.fetchRegions(needed, async (ctx: FetchContext) => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'RenderWiggleData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  ...self.rpcProps(),
                  stopToken: ctx.stopToken,
                  bpPerPx,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                self.setRpcData(r.displayedRegionIndex, result)
              }
            }),
          )
          if (!ctx.isStale()) {
            self.setLoadedBpPerPx(bpPerPx)
          }
        })
      },
    }))
    .views(self => ({
      trackMenuItems() {
        return [
          {
            label: 'Rendering type',
            subMenu: (
              [
                ['xyplot', 'XY plot'],
                ['density', 'Density'],
                ['line', 'Line'],
                ['scatter', 'Scatter'],
              ] as const
            ).map(([value, label]) => ({
              label,
              type: 'radio' as const,
              checked: self.renderingType === value,
              onClick: () => {
                self.setRenderingType(value)
              },
            })),
          },
          ...makeResolutionAndSummarySubMenus(self),
          {
            label: 'Score',
            icon: EqualizerIcon,
            subMenu: [
              makeScaleTypeSubMenu(self),
              makeAutoscaleTypeSubMenu(self),
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
          {
            label: 'Draw cross hatches',
            type: 'checkbox',
            checked: self.displayCrossHatches,
            onClick: () => {
              self.toggleCrossHatches()
            },
          },
        ]
      },
    }))
    .actions(self => ({
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearWiggleDisplayModel, opts)
      },
      startGpuBackendLifecycle(backend: WiggleBackend) {
        installPerRegionWiggleLifecycle(self, self.rpcDataMap, backend, data =>
          buildSourceRenderData(data, self.gpuProps()),
        )
      },
    }))
}

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>
