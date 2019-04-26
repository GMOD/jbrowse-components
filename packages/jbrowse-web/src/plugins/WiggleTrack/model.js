import { types, addDisposer, getRoot, getSnapshot } from 'mobx-state-tree'
import { autorun } from 'mobx'

import { ConfigurationReference, getConf } from '../../configuration'

import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import WiggleTrackComponent from './components/WiggleTrackComponent'
import { getParentRenderProps, getContainingView } from '../../util/tracks'
import { getNiceDomain } from '../WiggleRenderer/util'
import { checkAbortSignal, isAbortException } from '../../util'

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
])
export default (pluginManager, configSchema) =>
  types.compose(
    'WiggleTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('WiggleTrack'),
        configuration: ConfigurationReference(configSchema),
        selectedRendering: types.optional(types.string, ''),
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
        setRenderer(newRenderer) {
          self.selectedRendering = newRenderer
        },
      }))
      .views(self => ({
        get rendererTypeName() {
          const defaultRendering = getConf(self, 'defaultRendering')
          const viewName = self.selectedRendering || defaultRendering
          const rendererType = rendererTypes.get(viewName)
          if (!rendererType)
            throw new Error(`unknown alignments view name ${viewName}`)
          return rendererType
        },
        get renderProps() {
          const config = self.rendererType.configSchema.create(
            getConf(self, ['renderers', self.rendererTypeName]) || {},
          )
          const highResolutionScaling = getConf(
            getRoot(self),
            'highResolutionScaling',
          )
          const { height, ready, domain } = self
          const { min, max } = domain
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
              domain: [min, max],
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
