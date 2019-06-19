import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { checkAbortSignal, isAbortException } from '@gmod/jbrowse-core/util'
import {
  getContainingView,
  getParentRenderProps,
} from '@gmod/jbrowse-core/util/tracks'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { autorun } from 'mobx'
import { addDisposer, getRoot, getSnapshot, types } from 'mobx-state-tree'
import { getNiceDomain } from '../util'
import WiggleTrackComponent from './components/WiggleTrackComponent'

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])
export default configSchema =>
  types.compose(
    'WiggleTrack',
    blockBasedTrackModel,
    types
      .model({
        type: types.literal('WiggleTrack'),
        configuration: ConfigurationReference(configSchema),
        selectedRendering: types.optional(types.string, ''),
      })
      .actions(self => ({
        afterAttach() {
          const getYAxisScale = autorun(
            async function getYAxisScaleAutorun() {
              try {
                const { rpcManager } = getRoot(self)
                const autoscaleType = getConf(self, 'autoscale')
                const aborter = new AbortController()
                const { signal } = aborter
                let statsPromise
                self.setLoading(aborter)

                if (autoscaleType === 'global') {
                  statsPromise = rpcManager.call(
                    'statsGathering',
                    'getGlobalStats',
                    {
                      adapterConfig: getSnapshot(self.configuration.adapter),
                      adapterType: self.configuration.adapter.type,
                      signal,
                    },
                  )
                } else if (autoscaleType === 'local') {
                  const { dynamicBlocks, bpPerPx } = getContainingView(self)

                  // possibly useful for the rpc group name to be the same group as getFeatures
                  // reason: local stats fetches feature data that might get cached which getFeatures can use
                  statsPromise = rpcManager.call(
                    'statsGathering',
                    'getMultiRegionStats',
                    {
                      adapterConfig: getSnapshot(self.configuration.adapter),
                      adapterType: self.configuration.adapter.type,
                      regions: dynamicBlocks.blocks,
                      signal,
                      bpPerPx,
                    },
                  )
                }

                const stats = await statsPromise
                checkAbortSignal(aborter.signal)
                self.updateScale(stats)
              } catch (e) {
                if (!isAbortException(e)) {
                  self.setError(e)
                }
              }
            },
            { delay: 1000 },
          )

          addDisposer(self, getYAxisScale)
        },
        updateScale(stats) {
          self.stats.setStats(stats)
          self.ready = true
        },
        setLoading(abortSignal) {
          if (
            self.statsFetchInProgress &&
            !self.statsFetchInProgress.signal.aborted
          ) {
            self.statsFetchInProgress.abort()
          }
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
        get domain() {
          return getNiceDomain({
            domain: [self.stats.min, self.stats.max],
            scaleType: getConf(self, 'scaleType'),
            bounds: [getConf(self, 'minScore'), getConf(self, 'maxScore')],
          })
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
              domain,
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
        stats: types
          .model('stats', { min: 0, max: 0, mean: 0 })
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
