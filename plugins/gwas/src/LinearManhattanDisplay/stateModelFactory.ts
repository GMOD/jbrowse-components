import { lazy } from 'react'
import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSelectionContainer,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import { autorun, observable } from 'mobx'

import TooltipComponent from './components/TooltipComponent.tsx'
import { YSCALEBAR_LABEL_OFFSET } from './manhattanDrawUtils.ts'

import type { ManhattanHit } from './findManhattanHit.ts'
import type { ManhattanBackend, ManhattanRegionData, ManhattanRenderState } from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../RenderManhattanDataRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Feature, Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

// FetchContext shape from MultiRegionDisplayMixin — inlined to avoid importing
// from @jbrowse/plugin-linear-genome-view's internal modules.
interface FetchCtx {
  stopToken: StopToken
  isStale: () => boolean
}

// Minimal duck-typed self for installManhattanLifecycle.
// rpcDataMap and encode are passed as explicit params (see installPerRegionWiggleLifecycle pattern).
interface ManhattanLifecycleSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
  renderBlocks: RenderBlock[]
  manhattanRenderState: ManhattanRenderState | undefined
  // GWAS overrides wiggle's gpuProps with a Manhattan-specific shape; the
  // duck-typed cast avoids the MST composition type clash with the base.
  gpuProps: () => { colorAbgr: number }
}

// Duck-typed self for fetchNeeded actions.
interface FetchManhattanSelf extends IAnyStateTreeNode {
  adapterConfig: Record<string, unknown> | undefined
  fetchRegions(
    needed: { region: Region; displayedRegionIndex: number }[],
    work: (ctx: FetchCtx) => Promise<void>,
  ): Promise<void>
  setStatusMessage(msg?: string): void
}

const LinearManhattanDisplayComponent = lazy(
  () => import('./components/LinearManhattanDisplayComponent.tsx'),
)

function encodeRegion(data: ManhattanRpcResult, colorAbgr: number): ManhattanRegionData {
  return {
    positions: data.positions,
    scores: data.scores,
    colors: new Uint32Array(data.numFeatures).fill(colorAbgr),
    numFeatures: data.numFeatures,
  }
}

/**
 * Per-region streamed upload for Manhattan. Follows installPerRegionWiggleLifecycle
 * pattern: rpcDataMap and encode are explicit params so self only needs the GPU
 * lifecycle interface, not the data-specific properties.
 */
function installManhattanLifecycle(
  self: ManhattanLifecycleSelf,
  rpcDataMap: ObservableMap<number, ManhattanRpcResult>,
  backend: ManhattanBackend,
  encode: (data: ManhattanRpcResult) => ManhattanRegionData,
) {
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })

  self.installGpuDisplay<ManhattanBackend>(backend, {
    upload: b => {
      const active: number[] = []
      for (const key of rpcDataMap.keys()) {
        active.push(key)
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              const data = rpcDataMap.get(key)
              const bCurrent = self.currentGpuBackend as ManhattanBackend | undefined
              if (data !== undefined && bCurrent !== undefined) {
                bCurrent.uploadRegion(key, encode(data))
                self.renderNow()
              }
            }),
          )
        }
      }
      const activeSet = new Set(active)
      for (const [key, dispose] of perKeyDisposers) {
        if (!activeSet.has(key)) {
          dispose()
          perKeyDisposers.delete(key)
        }
      }
      b.pruneRegions(active)
    },
    render: b => {
      const state = self.manhattanRenderState
      if (!state) {
        return false
      }
      return b.renderBlocks(self.renderBlocks, state)
    },
  })
}

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
      manhattanRpcDataMap: observable.map<number, ManhattanRpcResult>(),
      manhattanFeatureUnderMouse: undefined as ManhattanHit | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       */
      get TooltipComponent() {
        return TooltipComponent
      },
      /**
       * #getter
       */
      get DisplayMessageComponent(): React.ComponentType<any> {
        return LinearManhattanDisplayComponent
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'LinearManhattanRenderer'
      },
      /**
       * #getter
       */
      get needsScalebar() {
        return true
      },
      /**
       * #getter
       */
      get regionTooLarge() {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides wiggle's domain — derived from GWAS score stats.
       * manhattanRpcDataMap drives this instead of wiggle's rpcDataMap.
       */
      get domain() {
        if (self.manhattanRpcDataMap.size === 0) {
          return undefined
        }
        let scoreMin = Infinity
        let scoreMax = -Infinity
        let scoreSum = 0
        let scoreSumSq = 0
        let n = 0
        for (const d of self.manhattanRpcDataMap.values()) {
          if (d.scoreMin < scoreMin) {
            scoreMin = d.scoreMin
          }
          if (d.scoreMax > scoreMax) {
            scoreMax = d.scoreMax
          }
          scoreSum += d.scoreSum
          scoreSumSq += d.scoreSumSq
          n += d.numFeatures
        }
        if (scoreMin > scoreMax || n === 0) {
          return undefined
        }
        const scoreMean = scoreSum / n
        const scoreStdDev = Math.sqrt(Math.max(0, scoreSumSq / n - scoreMean * scoreMean))
        const numStdDev = getConf(self, 'numStdDev') as number
        // minScoreConfig/maxScoreConfig aren't surfaced by TS through MST composition
        const { minScoreConfig, maxScoreConfig } = self as unknown as {
          minScoreConfig: number | undefined
          maxScoreConfig: number | undefined
        }
        return getNiceDomain({
          domain: domainFromStats(
            { scoreMin, scoreMax, scoreMean, scoreStdDev },
            self.autoscaleType,
            numStdDev,
          ),
          bounds: [minScoreConfig, maxScoreConfig] as const,
          scaleType: self.scaleType,
        })
      },

      /**
       * #method
       * Returns only GPU-encoding params. Color changes re-upload without
       * a new RPC fetch. See ARCHITECTURE.md rpcProps/gpuProps pattern.
       */
      gpuProps() {
        return {
          colorAbgr: cssColorToABGR(
            getConf(self, ['renderers', 'LinearManhattanRenderer', 'color']) as string,
          ),
        }
      },

      /**
       * #method
       * GWAS data is zoom-independent — override wiggle's rpcProps so
       * changes to wiggle-only settings (bicolorPivot, resolution) do
       * not trigger unnecessary refetches.
       */
      rpcProps() {
        return {}
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get manhattanRenderState(): ManhattanRenderState | undefined {
        const domain = self.domain
        if (!domain) {
          return undefined
        }
        const view = getContainingView(self) as unknown as { trackWidthPx: number }
        return {
          domainY: domain,
          scaleType: self.scaleType === 'log' ? 1 : 0,
          canvasWidth: view.trackWidthPx,
          canvasHeight: self.height - 2 * YSCALEBAR_LABEL_OFFSET,
          pointRadius: 2,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setManhattanRpcData(displayedRegionIndex: number, data: ManhattanRpcResult) {
        self.manhattanRpcDataMap.set(displayedRegionIndex, data)
      },

      setManhattanFeatureUnderMouse(hit: ManhattanHit | undefined) {
        self.manhattanFeatureUnderMouse = hit
      },

      clearDisplaySpecificData() {
        self.manhattanRpcDataMap.clear()
      },

      /**
       * #action
       * GWAS data doesn't vary with bpPerPx (unlike BigWig zoom levels).
       * Always return true so zooming does not discard loaded data.
       */
      isCacheValid(_displayedRegionIndex: number) {
        return true
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async fetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const s = self as unknown as FetchManhattanSelf
        const { adapterConfig } = s
        if (!adapterConfig) {
          return
        }
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        await s.fetchRegions(needed, async ctx => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'RenderManhattanData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  stopToken: ctx.stopToken,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      s.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                self.setManhattanRpcData(
                  r.displayedRegionIndex,
                  result as ManhattanRpcResult,
                )
              }
            }),
          )
        })
      },
      /**
       * #action
       * Opens the feature detail widget instead of popping a default dialog.
       */
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'BaseFeatureWidget',
            'baseFeature',
            {
              view: getContainingView(self),
              track: getContainingTrack(self),
              featureData: feature.toJSON(),
            },
          )
          session.showWidget(featureWidget)
        }
        if (isSelectionContainer(session)) {
          session.setSelection(feature)
        }
      },
      /**
       * #action
       */
      startGpuBackendLifecycle(backend: ManhattanBackend) {
        const s = self as unknown as ManhattanLifecycleSelf
        installManhattanLifecycle(
          s,
          self.manhattanRpcDataMap,
          backend,
          data => encodeRegion(data, s.gpuProps().colorAbgr),
        )
      },
    }))
}

export type LinearManhattanDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearManhattanDisplayModel = Instance<LinearManhattanDisplayStateModel>

// re-exported so the generated .d.ts can name these types without TS errors
export type * as d3scale from 'd3-scale'
export type * as mobx from 'mobx'