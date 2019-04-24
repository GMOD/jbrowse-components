import { types, addDisposer, getRoot, getSnapshot } from 'mobx-state-tree'
import { autorun } from 'mobx'

import { ConfigurationReference, getConf } from '../../configuration'

import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import WiggleTrackComponent from './components/WiggleTrackComponent'
import { getParentRenderProps, getContainingView } from '../../util/tracks'
import { getNiceDomain } from '../WiggleRenderer/util'
import { checkAbortSignal, isAbortException } from '../../util'
import WiggleRendererConfigSchema from '../WiggleRenderer/configSchema'

export default (pluginManager, configSchema) =>
  types.compose(
    'WiggleTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('WiggleTrack'),
        configuration: ConfigurationReference(configSchema),
        height: types.optional(types.integer, 100),
      })
      .actions(self => ({
        afterAttach() {
          const getYAxisScale = autorun(
            function getYAxisScaleAutorun() {
              const { rpcManager } = getRoot(self)

              const autoscaleType = getConf(self, 'autoscale')
              const aborter = new AbortController()
              self.setLoading(aborter)

              if (autoscaleType === 'global') {
                self.statsPromise = self.adapter.getGlobalStats(aborter.signal)
              } else if (autoscaleType === 'local') {
                const { dynamicBlocks, bpPerPx } = getContainingView(self)
                if (!dynamicBlocks.length) return

                // possibly useful for the rpc group name to be the same group as getFeatures
                // reason: local stats fetches feature data that might get cached which getFeatures can use
                self.statsPromise = rpcManager.call(
                  'statsGathering',
                  'getMultiRegionStats',
                  {
                    adapterConfig: getSnapshot(self.configuration.adapter),
                    adapterType: self.configuration.adapter.type,
                    regions: dynamicBlocks.map(r => ({ ...r, bpPerPx })),
                    signal: aborter.signal,
                  },
                )
              }

              self.statsPromise
                .then(stats => {
                  checkAbortSignal(aborter.signal)
                  self.updateScale(stats)
                })
                .catch(e => {
                  if (!isAbortException(e)) {
                    throw e
                  }
                })
            },
            { delay: 1000 },
          )

          addDisposer(self, getYAxisScale)
        },
        updateScale(stats) {
          self.stats.setStats(stats)
          self.domain.setDomain({
            domain: [stats.scoreMin, stats.scoreMax],
            scaleType: getConf(self, 'scaleType'),
            bounds: [getConf(self, 'minScore'), getConf(self, 'maxScore')],
          })
          self.ready = true
        },
        setLoading(abortSignal) {
          if (
            self.statsFetchInProgress &&
            !self.statsFetchInProgress.signal.aborted
          )
            self.statsFetchInProgress.abort()
          self.statsFetchInProgress = abortSignal
        },
      }))
      .views(self => ({
        get rendererTypeName() {
          return self.configuration.renderer.type
        },
        get renderProps() {
          const config = WiggleRendererConfigSchema.create(
            getConf(self, 'renderer'),
          )
          const highResolutionScaling = getConf(
            getRoot(self),
            'highResolutionScaling',
          )
          const { height, ready, domain, stats } = self
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            notReady: !ready,
            config,
            onFeatureClick(event, featureId) {
              // try to find the feature in our layout
              const feature = self.features.get(featureId)
              self.selectFeature(feature)
            },
            onClick() {
              self.clearFeatureSelection()
            },
            scaleOpts: {
              domain: [domain.min, domain.max],
              stats,
              range: [0, height],
              bounds: [getConf(self, 'minScore'), getConf(self, 'maxScore')],
              scaleType: getConf(self, 'scaleType'),
              inverted: getConf(self, 'inverted'),
            },
            height,
            highResolutionScaling,
          }
        },
      }))
      .volatile(() => ({
        reactComponent: WiggleTrackComponent,
        ready: false,
        domain: types
          .model('domain', { min: 0, max: 0 })
          .actions(self => ({
            setDomain({ domain, scaleType, bounds }) {
              const [min, max] = getNiceDomain({ domain, scaleType, bounds })
              self.min = min
              self.max = max
            },
          }))
          .create(),
        stats: types
          .model('domain', { min: 0, max: 0, mean: 0 })
          .actions(self => ({
            setStats(stats) {
              self.min = stats.scoreMin
              self.max = stats.scoreMax
              self.mean = stats.scoreMean
            },
          }))
          .create(),
      })),
  )
