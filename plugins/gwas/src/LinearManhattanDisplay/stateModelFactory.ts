import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { installPerRegionGpuLifecycle } from '@jbrowse/core/gpu/installPerRegionGpuLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import {
  WiggleScoreConfigMixin,
  rendererMenuItems,
} from '@jbrowse/plugin-wiggle'
import {
  YSCALEBAR_LABEL_OFFSET,
  getNiceDomain,
  getScale,
} from '@jbrowse/wiggle-core'
import { observable } from 'mobx'

import TooltipComponent from './components/TooltipComponent.tsx'
import { computeManhattanScoreRange } from './computeManhattanScoreRange.ts'

import type { ManhattanHit } from './findManhattanHit.ts'
import type {
  ManhattanBackend,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const LinearManhattanDisplayComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent.tsx'),
)

export function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearManhattanDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      WiggleScoreConfigMixin(),
      types.model({
        type: types.literal('LinearManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      // 1:1 points keyed by displayedRegionIndex.
      rpcDataMap: observable.map<number, ManhattanRpcResult>(),
      // Currently hovered point — drives the hover circle + tooltip.
      manhattanHit: undefined as ManhattanHit | undefined,
    }))
    .views(self => ({
      get DisplayMessageComponent() {
        return LinearManhattanDisplayComponent
      },
      get TooltipComponent() {
        return TooltipComponent
      },
      get color() {
        return self.getConfWithOverride<string>('color')
      },
      get domain(): [number, number] | undefined {
        const range = computeManhattanScoreRange(self.rpcDataMap.values())
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [self.minScoreConfig, self.maxScoreConfig],
          scaleType: 'linear',
        })
      },
    }))
    .views(self => ({
      get ticks() {
        const { height, domain, scaleType } = self
        if (!domain) {
          return undefined
        }
        const yTop = YSCALEBAR_LABEL_OFFSET
        const yBottom = height - YSCALEBAR_LABEL_OFFSET - 1
        const scale = getScale({
          scaleType,
          domain,
          range: [yBottom, yTop],
          inverted: false,
        })
        const minimalTicks = self.getConfWithOverride<boolean>('minimalTicks')
        const values =
          height < 100 || minimalTicks ? (domain as number[]) : scale.ticks(4)
        return {
          ticks: values.map(v => ({ value: v, y: scale(v) })),
          yTop,
          yBottom,
        }
      },
      // SettingsInvalidate watches this shape — only `color` triggers a
      // refetch (the worker bakes per-feature color into the result).
      rpcProps(): { color: string } {
        return { color: self.color }
      },
      // Manhattan data is pre-transformed (-log10 p values) and zoom-
      // independent. MultiRegionDisplayMixin's default isCacheValid is `true`,
      // so no override is needed.
      manhattanRenderState(): ManhattanRenderState | undefined {
        if (!self.domain) {
          return undefined
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        return {
          domainY: self.domain,
          canvasWidth: view.trackWidthPx,
          canvasHeight: self.height,
        }
      },
      // Manhattan menu: just the shared Score submenu and cross-hatch toggle.
      // Rendering type / Resolution / Scale type don't apply to single-point
      // rendering of pre-transformed -log10 p values.
      trackMenuItems() {
        return rendererMenuItems(self)
      },
    }))
    .actions(self => ({
      setRpcData(idx: number, data: ManhattanRpcResult) {
        self.rpcDataMap.set(idx, data)
      },
      setManhattanHit(hit: ManhattanHit | undefined) {
        self.manhattanHit = hit
      },
      setColor(color?: string) {
        self.setOverride('color', color)
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
      },
      reload() {
        self.clearAllRpcData()
      },
    }))
    .actions(self => ({
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const { adapterConfig } = self
        if (!adapterConfig) {
          return
        }
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        await self.fetchRegions(needed, async (ctx: FetchContext) => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'GetManhattanData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  ...self.rpcProps(),
                  stopToken: ctx.stopToken,
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
        })
      },
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearManhattanDisplayModel, opts)
      },
      // Identity encode — RPC result is the upload payload.
      startGpuBackendLifecycle(backend: ManhattanBackend) {
        installPerRegionGpuLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          b => {
            const state = self.manhattanRenderState()
            if (state) {
              b.renderBlocks(self.renderBlocks, state)
              return true
            }
            return false
          },
        )
      },
    }))
}

export type LinearManhattanDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearManhattanDisplayModel =
  Instance<LinearManhattanDisplayStateModel>
