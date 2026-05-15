import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { domainFromStats, getNiceDomain } from '@jbrowse/wiggle-core'
import { observable } from 'mobx'

import TooltipComponent from './components/TooltipComponent.tsx'
import { installManhattanLifecycle } from './installManhattanLifecycle.ts'
import {
  aggregateScoreStats,
  encodeRegion,
  makeManhattanRenderState,
} from './manhattanStateUtils.ts'

import type { ManhattanBackend } from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../RenderManhattanDataRPC/rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
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
      manhattanRpcDataMap: observable.map<number, ManhattanRpcResult>(),
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
      get DisplayMessageComponent() {
        return LinearManhattanDisplayComponent
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
        const stats = aggregateScoreStats(self.manhattanRpcDataMap.values())
        return stats
          ? getNiceDomain({
              domain: domainFromStats(
                stats,
                self.autoscaleType,
                getConf(self, 'numStdDev'),
              ),
              bounds: [self.minScoreConfig, self.maxScoreConfig],
              scaleType: self.scaleType,
            })
          : undefined
      },

      /**
       * #getter
       * Color packed as ABGR for GPU upload. Tracked inside the per-region
       * autorun, so changing the config re-uploads without a new RPC fetch.
       */
      get colorAbgr() {
        return cssColorToABGR(getConf(self, 'color') as string)
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
      get manhattanRenderState() {
        return makeManhattanRenderState({
          domain: self.domain,
          view: getContainingView(self) as LinearGenomeViewModel,
          height: self.height,
          scaleType: self.scaleType,
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setManhattanRpcData(
        displayedRegionIndex: number,
        data: ManhattanRpcResult,
      ) {
        self.manhattanRpcDataMap.set(displayedRegionIndex, data)
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
        const { adapterConfig } = self
        if (adapterConfig) {
          const sessionId = getRpcSessionId(self)
          const { rpcManager } = getSession(self)
          await self.fetchRegions(needed, async (ctx: FetchContext) => {
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
                        self.setStatusMessage(msg)
                      }
                    },
                  },
                )
                if (!ctx.isStale()) {
                  self.setManhattanRpcData(r.displayedRegionIndex, result)
                }
              }),
            )
          })
        }
      },
      /**
       * #action
       */
      startGpuBackendLifecycle(backend: ManhattanBackend) {
        installManhattanLifecycle(
          self,
          self.manhattanRpcDataMap,
          backend,
          data => encodeRegion(data, self.colorAbgr),
        )
      },
    }))
}

export type LinearManhattanDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearManhattanDisplayModel = Instance<LinearManhattanDisplayStateModel>