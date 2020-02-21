import {
  getConf,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import { BaseTrack } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import ComboTrackComponent from './components/ComboTrack'

export default (pluginManager, configSchema) => {
  return types.compose(
    'ComboTrack',
    BaseTrack,
    types
      .model({
        AlignmentsTrack: types.maybe(
          pluginManager.getTrackType('AlignmentsTrack').stateModel,
        ),
        SNPCoverageTrack: types.maybe(
          pluginManager.getTrackType('SNPCoverageTrack').stateModel,
        ),
        type: types.literal('ComboTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 250,
      })
      .volatile(() => ({
        ReactComponent: ComboTrackComponent,
      }))
      .actions(self => ({
        afterAttach() {
          const {
            alignmentsTrackConfig,
            snpCoverageTrackConfig,
          } = self.configuration

          self.AlignmentsTrack = {
            type: 'AlignmentsTrack',
            configuration: alignmentsTrackConfig,
          }
          snpCoverageTrackConfig.trackId !== 'placeholderId' // temp conditional while adding snpcoverage to config is necessary
            ? (self.SNPCoverageTrack = {
                type: 'SNPCoverageTrack',
                configuration: snpCoverageTrackConfig,
              })
            : delete self.SNPCoverageTrack

          /* Below is a theoretical version if the configSchema only required generic track info rather
             than specific alignments/snp coverage track info. Issue is config editor options must all be top level */
          // self.AlignmentsTrack = {
          //   type: 'AlignmentsTrack',
          //   configuration: {
          //     ...getConf(self, 'alignmentsTrackConfig'),
          //     type: 'AlignmentsTrack',
          //     name: `${getConf(self, 'name')} pileup`,
          //     trackId: `${self.configuration.trackId}_pileup`,
          //   },
          // }
          // self.SNPCoverageTrack = {
          //   type: 'SNPCoverageTrack',
          //   configuration: {
          //     ...getConf(self, 'alignmentsTrackConfig'),
          //     type: 'SNPCoverageTrack',
          //     name: `${getConf(self, 'name')} snpcoverage`,
          //     trackId: `${self.configuration.trackId}_snpcoverage`,
          //     adapter: {
          //       type: 'SNPCoverageAdapter',
          //       subadapter: getConf(self, 'alignmentsTrackConfig').adapter,
          //     },
          //   },
          // }
        },
      })),
  )
}
