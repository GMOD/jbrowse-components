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
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { autorun } from 'mobx'
import { addDisposer, getSnapshot, isAlive, types } from 'mobx-state-tree'
import { getNiceDomain } from '../util'
import WiggleTrackComponent from './components/WiggleTrackComponent'

// using a map because it preserves order
const rendererTypes = new Map([
  ['xyplot', 'XYPlotRenderer'],
  ['density', 'DensityRenderer'],
  ['line', 'LinePlotRenderer'],
])

function getStats(self, signal) {
  const { rpcManager } = getSession(self)
  const autoscaleType = getConf(self, 'autoscale')
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
  return {}
}

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
          addDisposer(
            self,
            autorun(
              async function getYAxisScaleAutorun() {
                try {
                  const aborter = new AbortController()
                  self.setLoading(aborter)
                  const stats = await getStats(self, aborter.signal)
                  if (isAlive(self)) {
                    self.updateScale(stats)
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
          return {
            ...getParentRenderProps(self),
            notReady: !self.ready,
            trackModel: self,
            config,
            scaleOpts: {
              domain: self.domain,
              scaleType: getConf(self, 'scaleType'),
              inverted: getConf(self, 'inverted'),
            },
            height: self.height,
          }
        },
      }))
      .volatile(() => ({
        ReactComponent: WiggleTrackComponent,
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
