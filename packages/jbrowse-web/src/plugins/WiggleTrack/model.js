import { types, addDisposer, flow } from 'mobx-state-tree'
import { autorun } from 'mobx'

import { ConfigurationReference, getConf } from '../../configuration'

import BaseTrack from '../LinearGenomeView/models/baseTrack'
import WiggleTrackComponent from './components/WiggleTrackComponent'
import { getParentRenderProps, getContainingView } from '../../util/tracks'

export default (pluginManager, configSchema) =>
  types.compose(
    'WiggleTrack',
    BaseTrack,
    types
      .model({
        type: types.literal('WiggleTrack'),
        configuration: ConfigurationReference(configSchema),
        subtracks: types.array(
          pluginManager.getTrackType('BasicTrack').stateModel,
        ),
      })
      .actions(self => ({
        afterAttach() {
          const recreateSubtracks = autorun(
            function recreateSubtracksAutorun() {
              const subtrackConfs = getConf(self, 'subtracks')
              self.updateSubtracks(subtrackConfs)
            },
          )

          const getYAxisScale = autorun(
            function getYAxisScaleAutorun() {
              const { subtracks } = self
              const autoscaleType = getConf(self, 'autoscale')
              let stats

              if (autoscaleType === 'global') {
                stats = subtracks.map(s => s.adapter.getGlobalStats())
              } else if (autoscaleType === 'local') {
                const regions = getContainingView(self).dynamicBlocks
                if (!regions.length) return
                stats = subtracks.map(s => s.adapter.getLocalStats(regions))
              }
              self.getStats(stats)
            },
            { delay: 1000 },
          )

          addDisposer(self, getYAxisScale)
          addDisposer(self, recreateSubtracks)
        },
        updateSubtracks: subtrackConfs => {
          self.subtracks = subtrackConfs.map(track => ({
            configuration: track,
            type: 'BasicTrack',
          }))
        },

        // todo: need to send to RPC backend
        getStats: flow(function* processStats(p) {
          try {
            self.stats = yield Promise.all(p).then(s => {
              const min = Math.min(...s.map(e => e.scoreMin))
              const max = Math.max(...s.map(e => e.scoreMax))
              const mean =
                s.reduce((a, b) => a + b.scoreMean * b.featureCount) /
                s.reduce((a, b) => a + b.featureCount)

              return { min, max, mean }
            })
            self.ready = true
          } catch (e) {
            self.error = e // todo: part of model?
            console.error(e)
          }
        }),
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
            height: getConf(self, 'defaultHeight'),
            scaling: 2, // todo global config?
          }
        },
      }))
      .volatile(() => ({
        reactComponent: WiggleTrackComponent,
        yScale: types.frozen(),
        ready: false,
      })),
  )
