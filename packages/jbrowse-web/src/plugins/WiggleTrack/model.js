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
        error: types.maybe(types.string),
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
                stats = self.adapter.getLocalStats(regions)
              }
              stats.then(s => self.setStats(s)).catch(e => self.setError(e))
            },
            { delay: 1000 },
          )

          addDisposer(self, getYAxisScale)
        },
        setStats(s) {
          const { scoreMin: min, scoreMax: max, scoreMean: mean } = s
          self.stats = { min, max, mean }
          self.ready = true
        },
        setError(e) {
          self.error = `${e}`
        },
      }))
      .views(self => ({
        get renderProps() {
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            stats: self.stats,
            notReady: !self.ready,
            minScore: getConf(self, 'minScore'),
            maxScore: getConf(self, 'maxScore'),
            height: self.height,
            scaling: 2, // todo global config?
          }
        },
      }))
      .volatile(() => ({
        reactComponent: WiggleTrackComponent,
        rendererTypeName: 'WiggleRenderer',
        ready: false,
        stats: types.frozen(),
      })),
  )
