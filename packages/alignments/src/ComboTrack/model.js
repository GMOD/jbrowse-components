import { ConfigurationReference } from '@gmod/jbrowse-core/configuration'
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
          self.AlignmentsTrack = {
            type: 'AlignmentsTrack',
            configuration: self.configuration.alignmentsTrack,
          }
          self.configuration.hasCoverage.value
            ? (self.SNPCoverageTrack = {
                type: 'SNPCoverageTrack',
                configuration: self.configuration.snpCoverageTrack,
              })
            : delete self.SNPCoverageTrack
        },
      })),
  )
}
