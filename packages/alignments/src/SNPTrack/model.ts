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
import { autorun, observable } from 'mobx'
import { addDisposer, getSnapshot, isAlive, types } from 'mobx-state-tree'
import React from 'react'
import { getNiceDomain } from '../util'
import SNPTrackComponent from './components/SNPTrackComponent'

// using a map because it preserves order
const rendererTypes = new Map([['snpxy', 'SNPXYRenderer']])

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateModelFactory = (configSchema: any) =>
  types
    .compose(
      'SNPTrack',
      blockBasedTrackModel as BlockBasedTrackStateModel,
      types
        .model({
          type: types.literal('SNPTrack'),
          configuration: ConfigurationReference(configSchema),
          selectedRendering: types.optional(types.string, ''),
        })
        .volatile(() => ({
          // avoid circular reference since SNPTrackComponent receives this model
          ReactComponent: (SNPTrackComponent as unknown) as React.FC,
          ready: true, // false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stats: observable({ scoreMin: 0, scoreMax: 50 } as any), // undefined as undefined | any,
          statsFetchInProgress: undefined as undefined | AbortController,
        })),
    )
    .actions(self => {
      return {
        updateStats(stats: { scoreMin: number; scoreMax: number }) {
          self.stats.scoreMin = stats.scoreMin > 0 ? stats.scoreMin : 0
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
      let oldDomain: [number, number] = [0, 50]
      return {
        get rendererTypeName() {
          const viewName = getConf(self, 'defaultRendering')
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },

        get domain() {
          const ret = self.stats
            ? getNiceDomain({
                domain: [self.stats.scoreMin, self.stats.scoreMax],
                scaleType: getConf(self, 'scaleType'),
                bounds: [getConf(self, 'minScore'), getConf(self, 'maxScore')],
                snapVal: 1.5,
              })
            : [0, 50]

          ret[1] = Math.ceil(ret[1] / 20) * 20
          if (JSON.stringify(oldDomain) !== JSON.stringify(ret)) {
            oldDomain = ret
          }
          return oldDomain
        },

        get renderProps() {
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', this.rendererTypeName]) || {},
          )
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
      }
    })
    .actions(self => {
      function getStats(signal: AbortSignal) {
        const { rpcManager } = getSession(self) as {
          rpcManager: { call: Function }
        }
        const autoscaleType = getConf(self, 'autoscale', {})
        if (autoscaleType === 'local') {
          const { dynamicBlocks, bpPerPx } = getContainingView(self)
          return rpcManager.call('statsGathering', 'getMultiRegionStats', {
            adapterConfig: getSnapshot(self.configuration.adapter),
            adapterType: self.configuration.adapter.type,
            assemblyName: getTrackAssemblyName(self),
            regions: JSON.parse(JSON.stringify(dynamicBlocks.blocks)),
            signal,
            bpPerPx: bpPerPx || 1,
            startingLength: 100,
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

export type SNPTrackModel = ReturnType<typeof stateModelFactory>

export default stateModelFactory
