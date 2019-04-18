import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'

import { ConfigurationReference, getConf } from '../../configuration'

import BlockBasedTrack from '../LinearGenomeView/models/blockBasedTrack'
import WiggleTrackComponent from './components/WiggleTrackComponent'
import { getParentRenderProps, getContainingView } from '../../util/tracks'

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
              let stats

              if (autoscaleType === 'global') {
                stats = self.adapter.getGlobalStats()
              } else if (autoscaleType === 'local') {
                const regions = getContainingView(self).dynamicBlocks
                if (!regions.length) return
                stats = self.adapter.getMultiRegionStats(regions)
              }
              stats.then(s => self.setStats(s)).catch(e => self.setError(e))
            },
            { delay: 1000 },
          )

          addDisposer(self, getYAxisScale)
        },
        setStats(s) {
          self.stats.setStats(s)
          self.ready = true
        },
      }))
      .views(self => ({
        get renderProps() {
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            stats: self.stats,
            notReady: !self.ready,
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
        stats: types
          .model({
            min: 0,
            max: 0,
            mean: 0,
          })
          .actions(self => ({
            setStats(s) {
              self.min = s.scoreMin
              self.max = s.scoreMax
              self.mean = s.scoreMean
            },
          }))
          .create(),
      })),
  )
