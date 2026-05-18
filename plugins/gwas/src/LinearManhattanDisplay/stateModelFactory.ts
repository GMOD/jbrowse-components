import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { installPerRegionGpuLifecycle } from '@jbrowse/core/gpu/installPerRegionGpuLifecycle'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  linearWiggleDisplayModelFactory,
  rendererMenuItems,
} from '@jbrowse/plugin-wiggle'
import { getNiceDomain } from '@jbrowse/wiggle-core'
import { observable } from 'mobx'

import { computeManhattanScoreRange } from './computeManhattanScoreRange.ts'
import TooltipComponent from './components/TooltipComponent.tsx'

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
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearManhattanDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        type: types.literal('LinearManhattanDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      // 1:1 points keyed by displayedRegionIndex. The inherited wiggle
      // `rpcDataMap` (of type WiggleDataResult) is never written to in this
      // model — Manhattan owns its data path end-to-end. Don't try to use
      // it; the right read site is `manhattanData`.
      manhattanData: observable.map<number, ManhattanRpcResult>(),
      // Currently hovered point. Distinct from wiggle's `featureUnderMouse`
      // (different shape) — the hover circle + tooltip both read from here.
      manhattanHit: undefined as ManhattanHit | undefined,
    }))
    .views(self => ({
      get TooltipComponent() {
        return TooltipComponent
      },
      get DisplayMessageComponent() {
        return LinearManhattanDisplayComponent
      },
      get domain(): [number, number] | undefined {
        const range = computeManhattanScoreRange(self.manhattanData.values())
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
      // Replaces wiggle's rpcProps. SettingsInvalidate watches this shape —
      // only `color` triggers a refetch (the worker bakes per-feature color
      // into the result). Inherited wiggle keys (bicolorPivot, resolution)
      // are deliberately omitted: they would cause wasted refetches because
      // the GWAS executor doesn't consume them.
      rpcProps(): { color: string } {
        return { color: self.color }
      },
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
      // Replaces wiggle's menu — drops "Rendering type", "Resolution and
      // summary", and "Scale type" (none apply to single-point rendering of
      // pre-transformed -log10 p values). Reuses wiggle's shared Score +
      // cross-hatch items via rendererMenuItems.
      trackMenuItems() {
        return rendererMenuItems(self)
      },
    }))
    .actions(self => ({
      setManhattanData(idx: number, data: ManhattanRpcResult) {
        self.manhattanData.set(idx, data)
      },
      setManhattanHit(hit: ManhattanHit | undefined) {
        self.manhattanHit = hit
      },
      clearDisplaySpecificData() {
        self.manhattanData.clear()
      },
    }))
    .actions(self => ({
      // Mirrors plugins/wiggle/src/LinearWiggleDisplay/model.ts fetchNeeded.
      // Differences: no bpPerPx (GWAS data is zoom-independent) and no
      // setLoadedBpPerPx after fetch.
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
                  color: self.color,
                  stopToken: ctx.stopToken,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                self.setManhattanData(
                  r.displayedRegionIndex,
                  result as ManhattanRpcResult,
                )
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
          self.manhattanData,
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

export type LinearManhattanDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearManhattanDisplayModel = Instance<LinearManhattanDisplayStateModel>
