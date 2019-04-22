import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'

import { ConfigurationReference, getConf } from '../../configuration'

import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import WiggleTrackComponent from './components/WiggleTrackComponent'
import { getParentRenderProps, getContainingView } from '../../util/tracks'
import { getNiceDomain } from '../WiggleRenderer/util'

export default (pluginManager, configSchema) =>
  types.compose(
    'WiggleTrack',
    BlockBasedTrack,
    types
      .model({
        type: types.literal('WiggleTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .actions(self => ({
        afterAttach() {
          const getYAxisScale = autorun(
            function getYAxisScaleAutorun() {
              const autoscaleType = getConf(self, 'autoscale')
              const aborter = new AbortController()
              self.setLoading(aborter)

              if (autoscaleType === 'global') {
                self.statsPromise = self.adapter.getGlobalStats(aborter.signal)
              } else if (autoscaleType === 'local') {
                const regions = getContainingView(self).dynamicBlocks
                if (!regions.length) return
                self.statsPromise = self.adapter.getMultiRegionStats(
                  regions,
                  aborter.signal,
                )
              }

              self.statsPromise.then(s => self.setStats(s))
            },
            { delay: 1000 },
          )

          addDisposer(self, getYAxisScale)
        },
        setStats(s) {
          const { scoreMin: min, scoreMax: max } = s
          const scaleType = getConf(self, 'scaleType')
          const minScore = getConf(self, 'minScore')
          const maxScore = getConf(self, 'maxScore')
          self.domain.setStats({ min, max }, scaleType, minScore, maxScore)
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
        get renderProps() {
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            notReady: !self.ready,
            min: self.domain.min,
            max: self.domain.max,
            minScore: getConf(self, 'minScore'), // todo: passing config this way needed?
            maxScore: getConf(self, 'maxScore'),
            scaleType: getConf(self, 'scaleType'),
            inverted: getConf(self, 'inverted'),
            height: self.height,
            highResolutionScaling: 2, // todo global config?
          }
        },
      }))
      .volatile(() => ({
        reactComponent: WiggleTrackComponent,
        rendererTypeName: 'WiggleRenderer', // todo is this needed?
        ready: false,
        domain: types
          .model('domain', { min: 0, max: 0, mean: 0 })
          .actions(self => ({
            setStats(s, scaleType, minScore, maxScore) {
              const [min, max] = getNiceDomain(scaleType, [s.min, s.max], {
                minScore,
                maxScore,
              })
              console.log(min, max, scaleType, minScore, maxScore)
              self.min = min
              self.max = max
              self.mean = s.mean
            },
          }))
          .create(),
      })),
  )
