import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { isAbortException, getSession } from '@gmod/jbrowse-core/util'
import {
  getContainingView,
  getParentRenderProps,
  getTrackAssemblyName,
} from '@gmod/jbrowse-core/util/tracks'
import blockBasedTrackModel, {
  BlockBasedTrackStateModel,
} from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'
import { autorun } from 'mobx'
import { addDisposer, getSnapshot, isAlive, types } from 'mobx-state-tree'
import React from 'react'
import { getNiceDomain } from '../util'
import WiggleTrackComponent from './components/WiggleTrackComponent'

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types
    .compose(
      'WiggleTrack',
      blockBasedTrackModel as BlockBasedTrackStateModel,
      types
        .model({
          type: types.literal('WiggleTrack'),
          configuration: ConfigurationReference(configSchema),
        })
        .volatile(() => ({
          // avoid circular reference since WiggleTrackComponent receives this model
          ReactComponent: (WiggleTrackComponent as unknown) as React.FC,
          ready: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stats: undefined as undefined | any,
          statsFetchInProgress: undefined as undefined | AbortController,
        })),
    )
    .actions(self => {
      return {
        updateStats(stats: { scoreMin: number; scoreMax: number }) {
          self.stats = stats
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
    .views(self => ({
      get rendererTypeName() {
        const viewName = getConf(self, 'defaultRendering')
        const rendererType = rendererTypes.get(viewName)
        if (!rendererType)
          throw new Error(`unknown alignments view name ${viewName}`)
        return rendererType
      },

      get domain() {
        return self.stats
          ? getNiceDomain({
              domain: [self.stats.scoreMin, self.stats.scoreMax],
              scaleType: getConf(self, 'scaleType'),
              bounds: [getConf(self, 'minScore'), getConf(self, 'maxScore')],
            })
          : undefined
      },
      get renderProps() {
        const config = self.rendererType.configSchema.create({
          ...getConf(self, ['renderers', this.rendererTypeName]),
          configId: `${self.id}-renderer`,
        })
        console.log('hi1', config.configId, self.id)
        return {
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
    }))
    .actions(self => {
      function getStats(signal: AbortSignal) {
        const { rpcManager } = getSession(self) as {
          rpcManager: { call: Function }
        }
        const autoscaleType = getConf(self, 'autoscale', {})
        if (autoscaleType === 'global') {
          return rpcManager.call('statsGathering', 'getGlobalStats', {
            adapterConfig: getSnapshot(self.configuration.adapter),
            adapterType: self.configuration.adapter.type,
            signal,
          })
        }
        if (autoscaleType === 'local') {
          const { dynamicBlocks, bpPerPx } = getContainingView(self)
          return rpcManager.call('statsGathering', 'getMultiRegionStats', {
            adapterConfig: getSnapshot(self.configuration.adapter),
            adapterType: self.configuration.adapter.type,
            assemblyName: getTrackAssemblyName(self),
            regions: JSON.parse(JSON.stringify(dynamicBlocks.blocks)),
            signal,
            bpPerPx,
          })
        }
        if (autoscaleType === 'zscale') {
          return rpcManager.call('statsGathering', 'getGlobalStats', {
            adapterConfig: getSnapshot(self.configuration.adapter),
            adapterType: self.configuration.adapter.type,
            signal,
          })
        }
        return {}
      }
      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(
              async () => {
                try {
                  const aborter = new AbortController()
                  self.setLoading(aborter)
                  const stats = await getStats(aborter.signal)
                  if (isAlive(self)) {
                    self.updateStats(stats)
                  }
                } catch (e) {
                  if (!isAbortException(e)) {
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

export type WiggleTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
