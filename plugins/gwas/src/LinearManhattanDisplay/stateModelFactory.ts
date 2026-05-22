import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { installPerRegionLifecycle } from '@jbrowse/core/gpu/installPerRegionLifecycle'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingView,
  getSession,
  openFeatureWidget,
} from '@jbrowse/core/util'
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
  computeYTicks,
  getNiceDomain,
} from '@jbrowse/wiggle-core'
import { observable } from 'mobx'

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
      featureUnderMouse: undefined as ManhattanHit | undefined,
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
        let scoreMin = Infinity
        let scoreMax = -Infinity
        for (const d of self.rpcDataMap.values()) {
          if (d.numFeatures === 0) {
            continue
          }
          if (d.scoreMin < scoreMin) {
            scoreMin = d.scoreMin
          }
          if (d.scoreMax > scoreMax) {
            scoreMax = d.scoreMax
          }
        }
        if (!Number.isFinite(scoreMin)) {
          return undefined
        }
        return getNiceDomain({
          domain: [scoreMin, scoreMax],
          bounds: [self.minScoreConfig, self.maxScoreConfig],
          scaleType: 'linear',
        })
      },
    }))
    .views(self => ({
      // Manhattan plots are linear-only (pre-transformed -log10 p values);
      // the inherited scaleType config is intentionally ignored here so the
      // axis ticks stay consistent with the linear `domain` above.
      get ticks() {
        return computeYTicks({
          height: self.height,
          domain: self.domain,
          scaleType: 'linear',
          minimalTicks: self.getConfWithOverride<boolean>('minimalTicks'),
        })
      },
      // SettingsInvalidate watches this shape — only `color` triggers a
      // refetch (the worker bakes per-feature color into the result).
      rpcProps(): { color: string } {
        return { color: self.color }
      },
      // canvasHeight is the inner canvas (between top/bottom YScaleBar
      // label offsets) — this is the area both the GPU renderer and
      // findManhattanHit work in. Using self.height directly would drift
      // the hit-test off the rendered points.
      get renderState(): ManhattanRenderState | undefined {
        const view = getContainingView(self) as LinearGenomeViewModel
        const canvasWidth = view.trackWidthPx
        const canvasHeight = self.height - 2 * YSCALEBAR_LABEL_OFFSET
        if (self.domain) {
          return { domainY: self.domain, canvasWidth, canvasHeight }
        }
        // No domain ≡ either (a) no fetch has completed — keep undefined so
        // the loading overlay stays, or (b) fetch completed with zero
        // features — return a stub state so render runs, the canvas clears,
        // and canvasDrawn flips. Domain is arbitrary; nothing will draw.
        if (self.rpcDataMap.size === 0) {
          return undefined
        }
        return { domainY: [0, 1], canvasWidth, canvasHeight }
      },
      // displayedRegionIndex → refName lookup. Hit-testing reads this on
      // every mousemove; MobX caches the view so visibleRegions changes
      // invalidate it once rather than rebuilding per event.
      get regionRefNames(): ReadonlyMap<number, string> {
        const view = getContainingView(self) as LinearGenomeViewModel
        return new Map(
          view.visibleRegions.map(r => [r.displayedRegionIndex, r.refName]),
        )
      },
      // Manhattan menu: just the shared Score submenu and cross-hatch toggle.
      // Rendering type / Resolution / Scale type don't apply to single-point
      // rendering of pre-transformed -log10 p values.
      trackMenuItems() {
        return rendererMenuItems(self)
      },
    }))
    .actions(self => ({
      selectFeature(hit: ManhattanHit) {
        openFeatureWidget(self, {
          uniqueId: `manhattan-${hit.refName}-${hit.start}`,
          refName: hit.refName,
          start: hit.start,
          end: hit.end,
          score: hit.score,
        })
      },
      setRpcData(idx: number, data: ManhattanRpcResult) {
        self.rpcDataMap.set(idx, data)
      },
      setFeatureUnderMouse(hit: ManhattanHit | undefined) {
        self.featureUnderMouse = hit
      },
      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
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
      startBackend(backend: ManhattanBackend) {
        installPerRegionLifecycle(
          self,
          self.rpcDataMap,
          backend,
          data => data,
          b => {
            const state = self.renderState
            if (state) {
              b.renderBlocks(self.renderBlocks, self.rpcDataMap, state)
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
