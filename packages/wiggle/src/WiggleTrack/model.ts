import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import {
  isAbortException,
  getSession,
  getContainingView,
} from '@gmod/jbrowse-core/util'
import {
  getParentRenderProps,
  getTrackAssemblyNames,
  getRpcSessionId,
} from '@gmod/jbrowse-core/util/tracks'
import blockBasedTrackModel from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'
import { autorun, observable } from 'mobx'
import {
  addDisposer,
  getSnapshot,
  isAlive,
  types,
  Instance,
} from 'mobx-state-tree'
import React from 'react'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { getNiceDomain } from '../util'

import WiggleTrackComponent from './components/WiggleTrackComponent'
import Tooltip from './components/Tooltip'
import { FeatureStats } from '../statsUtil'
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
function round(v: number, b = 2) {
  return (v >= 0 ? 1 : -1) * Math.pow(b, 1 + Math.floor(logb(b, Math.abs(v))))
}

const stateModelFactory = (configSchema: ReturnType<typeof ConfigSchemaF>) =>
  types
    .compose(
      'WiggleTrack',
      blockBasedTrackModel,
      types
        .model({
          type: types.literal('WiggleTrack'),
          configuration: ConfigurationReference(configSchema),
          selectedRendering: types.optional(types.string, ''),
        })
        .volatile(() => ({
          // avoid circular reference since WiggleTrackComponent receives this model
          ReactComponent: (WiggleTrackComponent as unknown) as React.FC,
          ready: false,
          stats: observable({ scoreMin: 0, scoreMax: 50 }),
          statsFetchInProgress: undefined as undefined | AbortController,
        })),
    )
    .actions(self => {
      return {
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
      }
    })
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
          if (maxScore !== Number.MIN_VALUE && ret[1] > 1.0) {
            ret[1] = round(ret[1] + 10)
          }
          if (minScore !== Number.MAX_VALUE && ret[0] < -1.0) {
            ret[0] = round(ret[0] - 10)
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
            trackModel: self,
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

      async function getStats({
        headers,
        signal,
      }: {
        headers?: Record<string, string>
        signal?: AbortSignal
      }): Promise<FeatureStats> {
        const { rpcManager } = getSession(self)
        const nd = getConf(self, 'numStdDev')
        const autoscaleType = getConf(self, 'autoscale', [])
        const { adapter } = self.configuration
        if (autoscaleType === 'global' || autoscaleType === 'globalsd') {
          const r = (await rpcManager.call(
            getRpcSessionId(self),
            'WiggleGetGlobalStats',
            {
              adapterConfig: getSnapshot(adapter),
              signal,
              headers,
            },
          )) as FeatureStats
          return autoscaleType === 'globalsd'
            ? {
                ...r,
                // avoid unnecessary scoreMin<0 if the scoreMin is never less than 0
                // helps with most bigwigs just being >0
                scoreMin:
                  r.scoreMin >= 0 ? 0 : r.scoreMean - nd * r.scoreStdDev,
                scoreMax: r.scoreMean + nd * r.scoreStdDev,
              }
            : r
        }
        if (autoscaleType === 'local' || autoscaleType === 'localsd') {
          const { dynamicBlocks, bpPerPx } = getContainingView(
            self,
          ) as Instance<LinearGenomeViewStateModel>
          const sessionId = getRpcSessionId(self)
          // fallback if await fails?
          const r = (await rpcManager.call(
            sessionId,
            'WiggleGetMultiRegionStats',
            {
              adapterConfig: getSnapshot(adapter),
              // TODO: Figure this out for multiple assembly names
              assemblyName: getTrackAssemblyNames(self)[0],
              regions: JSON.parse(JSON.stringify(dynamicBlocks.contentBlocks)),
              sessionId,
              signal,
              bpPerPx,
            },
          )) as FeatureStats
          return autoscaleType === 'localsd'
            ? {
                ...r,
                // avoid unnecessary scoreMin<0 if the scoreMin is never less than 0
                // helps with most bigwigs just being >0
                scoreMin:
                  r.scoreMin >= 0 ? 0 : r.scoreMean - nd * r.scoreStdDev,
                scoreMax: r.scoreMean + nd * r.scoreStdDev,
              }
            : r
        }
        if (autoscaleType === 'zscale') {
          return rpcManager.call(
            getRpcSessionId(self),
            'WiggleGetGlobalStats',
            {
              adapterConfig: getSnapshot(adapter),
              signal,
              headers,
            },
          ) as Promise<FeatureStats>
        }
        throw new Error(`invalid autoscaleType '${autoscaleType}'`)
      }
      return {
        async reload() {
          self.setError('')
          console.log('snp reloading')

          const aborter = new AbortController()
          const stats = await getStats({
            signal: aborter.signal,
            headers: { cache: 'no-store,no-cache' },
          })
          self.updateStats(stats)
          superReload()

          // if it does not hit the ping timeout, reloading the snp coverage track is successful
          // only fails if worker/ping timesouts before completion. usually, fails on corerender now
        },
        afterAttach() {
          addDisposer(
            self,
            autorun(
              async () => {
                try {
                  const aborter = new AbortController()
                  self.setLoading(aborter)

                  const { dynamicBlocks } = getContainingView(self) as Instance<
                    LinearGenomeViewStateModel
                  >
                  if (!dynamicBlocks.contentBlocks.length && !self.ready) {
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

export type WiggleTrackStateModel = ReturnType<typeof stateModelFactory>
export type WiggleTrackModel = Instance<WiggleTrackStateModel>

export default stateModelFactory
