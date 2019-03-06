import { types, addDisposer, flow } from 'mobx-state-tree'
import { autorun } from 'mobx'

import { ConfigurationReference, readConfObject } from '../../configuration'

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
              const { configuration } = self
              const subtrackConfs = readConfObject(configuration, 'subtracks')
              self.updateSubtracks(subtrackConfs)
            },
          )

          const getYAxisScale = autorun(
            function getYAxisScaleAutorun() {
              const { subtracks, configuration } = self
              const autoscaleType = readConfObject(configuration, 'autoscale')
              let stats

              if (autoscaleType === 'global') {
                stats = subtracks.map(s => s.adapter.getGlobalStats())
              } else if (autoscaleType === 'local') {
                const regions = getContainingView(self).dynamicBlocks
                if (!regions.length) return
                stats = subtracks.map(s => s.adapter.getLocalStats(regions))
              }
              self.processStats(stats)
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
        processStats: flow(function* processStats(p) {
          try {
            self.yScale = yield Promise.all(p).then(s => {
              let min = Math.min(...s.map(e => e.scoreMin))
              let max = Math.max(...s.map(e => e.scoreMax))
              const minScore = readConfObject(self.configuration, 'minScore')
              const maxScore = readConfObject(self.configuration, 'maxScore')
              const mean =
                s.reduce((a, b) => a + b.scoreMean * b.featureCount, 0) /
                s.reduce((a, b) => a + b.featureCount, 0)
              if (minScore !== -Infinity) min = minScore
              if (maxScore !== Infinity) max = maxScore
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
            yScale: self.yScale,
            notReady: !self.ready,
          }
        },
      }))

      // actions
      // afterattach
      // autorun
      // add or remove subtracks from state model depending on changes to configSchema
      .volatile(() => ({
        reactComponent: WiggleTrackComponent,
        yScale: types.frozen(),
        ready: false,
      })),
  )
