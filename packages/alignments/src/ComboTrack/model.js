import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { modelFactory as snpcoverageStateModelFactory } from '../SNPCoverageTrack'
import { modelFactory as alignmentsTrackStateModelFactory } from '../AlignmentsTrack'
import ComboTrackComponent from './components/ComboTrack'

export default (pluginManager, configSchema) =>
  types.compose(
    'ComboTrack',
    blockBasedTrackModel,
    types
      .model({
        AlignmentsTrack: alignmentsTrackStateModelFactory(
          pluginManager,
          configSchema,
        ).preProcessSnapshot(snapshot => {
          return {
            ...snapshot,
            configuration: snapshot
              ? snapshot.configuration
              : { type: 'AlignmentsTrack' },
            type: 'AlignmentsTrack',
          }
        }),
        SNPCoverageTrack: snpcoverageStateModelFactory(
          configSchema,
        ).preProcessSnapshot(snapshot => {
          return {
            ...snapshot,
            configuration: snapshot
              ? snapshot.configuration
              : { type: 'SNPCoverageTrack' },
            type: 'SNPCoverageTrack',
          }
        }),
        type: types.literal('ComboTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .volatile(() => ({
        ReactComponent: ComboTrackComponent,
      }))
      .preProcessSnapshot(snapshot => {
        console.log(snapshot)
        return snapshot
      }),
  )
