import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import {
  isAbortException,
  getSession,
  getContainingView,
} from '@jbrowse/core/util'
import {
  getParentRenderProps,
  getRpcSessionId,
  getTrackAssemblyNames,
} from '@jbrowse/core/util/tracks'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun, observable } from 'mobx'
import { addDisposer, isAlive, types, Instance } from 'mobx-state-tree'
import React from 'react'

import { getNiceDomain } from '../../util'

import Tooltip from '../components/Tooltip'
import { FeatureStats } from '../../statsUtil'
import ConfigSchemaF from './configSchema'

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

function logb(x: number, y: number) {
  return Math.log(y) / Math.log(x)
}
function round(v: number, b = 1.5) {
  return (v >= 0 ? 1 : -1) * Math.pow(b, 1 + Math.floor(logb(b, Math.abs(v))))
}

type LGV = LinearGenomeViewModel

const stateModelFactory = (configSchema: ReturnType<typeof ConfigSchemaF>) =>
  types
    .compose(
      'LinearWiggleDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        selectedRendering: types.optional(types.string, ''),
      }),
    )
    .volatile(() => ({
      ready: false,
      message: undefined as undefined | string,
      stats: observable({ scoreMin: 0, scoreMax: 50 }),
      statsFetchInProgress: undefined as undefined | AbortController,
    }))
    .actions(self => ({
      updateStats(stats: { scoreMin: number; scoreMax: number }) {
        self.stats.scoreMin = stats.scoreMin
        self.stats.scoreMax = stats.scoreMax
        self.ready = true
      },

      setLoading(aborter: AbortController) {
        if (
          self.statsFetchInProgress !== undefined &&
          !self.statsFetchInProgress.signal.aborted
        ) {
          self.statsFetchInProgress.abort()
        }
        self.statsFetchInProgress = aborter
      },
    }))
    .views(self => {
      let oldDomain: [number, number] = [0, 0]
      return {
        get TooltipComponent(): React.FC {
          return (Tooltip as unknown) as React.FC
        },

        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        get domain() {
          const maxScore = getConf(self, 'maxScore')
          const minScore = getConf(self, 'minScore')
          const ret = getNiceDomain({
            domain: [self.stats.scoreMin, self.stats.scoreMax],
            scaleType: getConf(self, 'scaleType'),
            bounds: [minScore, maxScore],
          })

          // uses a heuristic to just give some extra headroom on bigwig scores
          if (maxScore !== Number.MIN_VALUE && ret[1] > 1.0) {
            ret[1] = round(ret[1])
          }
          if (minScore !== Number.MAX_VALUE && ret[0] < -1.0) {
            ret[0] = round(ret[0])
          }
          if (JSON.stringify(oldDomain) !== JSON.stringify(ret)) {
            oldDomain = ret
          }
          return oldDomain
        },

        get needsScalebar() {
          return (
            self.rendererTypeName === 'XYPlotRenderer' ||
            self.rendererTypeName === 'LinePlotRenderer'
          )
        },

        get renderProps() {
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', this.rendererTypeName]) || {},
          )

          return {
            ...self.composedRenderProps,
            ...getParentRenderProps(self),
            notReady: !self.ready,
            displayModel: self,
            config,
            scaleOpts: {
              domain: this.domain,
              stats: self.stats,
              autoscaleType: getConf(self, 'autoscale'),
              scaleType: getConf(self, 'scaleType'),
              inverted: getConf(self, 'inverted'),
            },
            height: self.height,
          }
        },
      }
    })
    .actions(self => {
      const superReload = self.reload

      async function getStats(opts: {
        headers?: Record<string, string>
        signal?: AbortSignal
      }): Promise<FeatureStats> {
        const { rpcManager } = getSession(self)
        const nd = getConf(self, 'numStdDev')
        const autoscaleType = getConf(self, 'autoscale', [])
        const { adapterConfig } = self
        if (autoscaleType === 'global' || autoscaleType === 'globalsd') {
          const results = (await rpcManager.call(
            getRpcSessionId(self),
            'WiggleGetGlobalStats',
            {
              adapterConfig,
              statusCallback: (message: string) => {
                if (isAlive(self)) {
                  self.setMessage(message)
                }
              },
              ...opts,
            },
          )) as FeatureStats
          const { scoreMin, scoreMean, scoreStdDev } = results
          // globalsd uses heuristic to avoid unnecessary scoreMin<0
          // if the scoreMin is never less than 0
          // helps with most coverage bigwigs just being >0
          return autoscaleType === 'globalsd'
            ? {
                ...results,
                scoreMin: scoreMin >= 0 ? 0 : scoreMean - nd * scoreStdDev,
                scoreMax: scoreMean + nd * scoreStdDev,
              }
            : results
        }
        if (autoscaleType === 'local' || autoscaleType === 'localsd') {
          const { dynamicBlocks, bpPerPx } = getContainingView(self) as LGV
          const sessionId = getRpcSessionId(self)
          const results = (await rpcManager.call(
            sessionId,
            'WiggleGetMultiRegionStats',
            {
              adapterConfig,
              assemblyName: getTrackAssemblyNames(self.parentTrack)[0],
              regions: JSON.parse(
                JSON.stringify(
                  dynamicBlocks.contentBlocks.map(region => {
                    const { start, end } = region
                    return {
                      ...region,
                      start: Math.floor(start),
                      end: Math.ceil(end),
                    }
                  }),
                ),
              ),
              sessionId,
              statusCallback: (message: string) => {
                if (isAlive(self)) {
                  self.setMessage(message)
                }
              },
              bpPerPx,
              ...opts,
            },
          )) as FeatureStats
          const { scoreMin, scoreMean, scoreStdDev } = results
          // localsd uses heuristic to avoid unnecessary scoreMin<0
          // if the scoreMin is never less than 0
          // helps with most coverage bigwigs just being >0
          return autoscaleType === 'localsd'
            ? {
                ...results,
                scoreMin: scoreMin >= 0 ? 0 : scoreMean - nd * scoreStdDev,
                scoreMax: scoreMean + nd * scoreStdDev,
              }
            : results
        }
        if (autoscaleType === 'zscale') {
          return rpcManager.call(
            getRpcSessionId(self),
            'WiggleGetGlobalStats',
            {
              adapterConfig,
              statusCallback: (message: string) => {
                if (isAlive(self)) {
                  self.setMessage(message)
                }
              },
              ...opts,
            },
          ) as Promise<FeatureStats>
        }
        throw new Error(`invalid autoscaleType '${autoscaleType}'`)
      }
      return {
        // re-runs stats and refresh whole display on reload
        async reload() {
          self.setError('')
          const aborter = new AbortController()
          const stats = await getStats({
            signal: aborter.signal,
            headers: { cache: 'no-store,no-cache' },
          })
          if (isAlive(self)) {
            self.updateStats(stats)
            superReload()
          }
        },
        afterAttach() {
          addDisposer(
            self,
            autorun(
              async () => {
                try {
                  const aborter = new AbortController()
                  self.setLoading(aborter)
                  const view = getContainingView(self) as LGV
                  if (
                    (!view.initialized && !self.ready) ||
                    view.bpPerPx > self.maxViewBpPerPx
                  ) {
                    return
                  }

                  const stats = await getStats({ signal: aborter.signal })

                  if (isAlive(self)) {
                    self.updateStats(stats)
                  }
                } catch (e) {
                  if (!isAbortException(e) && isAlive(self)) {
                    self.setError(e)
                  }
                }
              },
              { delay: 1000 },
            ),
          )
        },
      }
    })

export type WiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type WiggleDisplayModel = Instance<WiggleDisplayStateModel>

export default stateModelFactory
