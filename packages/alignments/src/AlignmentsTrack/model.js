import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types, addDisposer } from 'mobx-state-tree'
import { autorun } from 'mobx'
import AlignmentsTrackComponent from './components/AlignmentsTrack'

export default (pluginManager, configSchema) => {
  return types.compose(
    'AlignmentsTrack',
    BaseTrack,
    types
      .model({
        PileupTrack: types.maybe(
          pluginManager.getTrackType('PileupTrack').stateModel,
        ),
        SNPCoverageTrack: types.maybe(
          pluginManager.getTrackType('SNPCoverageTrack').stateModel,
        ),
        type: types.literal('AlignmentsTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 250,
      })
      .volatile(() => ({
        ReactComponent: AlignmentsTrackComponent,
      }))
      .views(self => ({
        get pileupTrackConfig() {
          return {
            ...getConf(self),
            type: 'PileupTrack',
            name: `${getConf(self, 'name')} pileup`,
            trackId: `${self.configuration.trackId}_pileup`,
          }
        },

        get snpCoverageTrackConfig() {
          return {
            ...getConf(self),
            type: 'SNPCoverageTrack',
            name: `${getConf(self, 'name')} snpcoverage`,
            trackId: `${self.configuration.trackId}_snpcoverage`,
            adapter: {
              type: 'SNPCoverageAdapter',
              subadapter: getConf(self, 'adapter'),
            },
          }
        },
      }))
      .actions(self => ({
        afterAttach() {
          // const {
          //   pileupTrackConfig,
          //   snpCoverageTrackConfig,
          // } = self.configuration

          // self.PileupTrack = {
          //   type: 'PileupTrack',
          //   configuration: pileupTrackConfig,
          // }
          // snpCoverageTrackConfig.trackId !== 'placeholderId' // temp conditional while adding snpcoverage to config is necessary
          //   ? (self.SNPCoverageTrack = {
          //       type: 'SNPCoverageTrack',
          //       configuration: snpCoverageTrackConfig,
          //     })
          //   : delete self.SNPCoverageTrack

          /* Below is a theoretical version if the configSchema only required generic track info rather
             than specific alignments/snp coverage track info. Issue is config editor options must all be top level */
          addDisposer(
            self,
            autorun(() => {
              self.setTrack('PileupTrack', self.pileupTrackConfig)
              self.setTrack('SNPCoverageTrack', self.snpCoverageTrackConfig)
            }),
          )
        },
        setTrack(trackType, trackConfig) {
          self[trackType] = {
            type: `${trackType}`,
            configuration: trackConfig,
          }
        },
      })),
  )
}
