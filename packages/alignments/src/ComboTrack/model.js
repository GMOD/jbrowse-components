import {
  ConfigurationReference,
  // getConf,
} from '@gmod/jbrowse-core/configuration'
import {
  // blockBasedTrackModel,
  BaseTrack,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
// import { modelFactory as snpcoverageStateModelFactory } from '../SNPCoverageTrack'
import {
  modelFactory as alignmentsTrackStateModelFactory,
  configSchemaFactory as alignmentsTrackConfigSchemaFactory,
} from '../AlignmentsTrack'
import {
  modelFactory as snpCoverageTrackStateModelFactory,
  configSchemaFactory as snpCoverageTrackConfigSchemaFactory,
} from '../SNPCoverageTrack'
import ComboTrackComponent from './components/ComboTrack'

export default (pluginManager, configSchema) => {
  const alignmentConfigSchema = alignmentsTrackConfigSchemaFactory(
    pluginManager,
  )
  const snpCoverageConfigSchema = snpCoverageTrackConfigSchemaFactory(
    pluginManager,
  )
  return types.compose(
    'ComboTrack',
    BaseTrack,
    types
      .model({
        AlignmentsTrack: alignmentsTrackStateModelFactory(
          pluginManager,
          alignmentConfigSchema,
        ),
        SNPCoverageTrack: snpCoverageTrackStateModelFactory(
          snpCoverageConfigSchema,
        ),
        type: types.literal('ComboTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .volatile(() => ({
        ReactComponent: ComboTrackComponent,
      }))
      .preProcessSnapshot(snap => {
        // console.log('BEFORE')
        const snapshot = JSON.parse(JSON.stringify(snap))
        const ret = {
          ...snapshot,
          AlignmentsTrack: {
            ...snapshot,
            configuration: {
              ...snapshot.configuration,
              trackId: `${snapshot.configuration.trackId}_pileup`,
              defaultRendering: 'pileup',
              type: 'AlignmentsTrack',
            },
            type: 'AlignmentsTrack',
          },
          SNPCoverageTrack: {
            ...snapshot,
            configuration: {
              ...snapshot.configuration,
              trackId: `${snapshot.configuration.trackId}_snpcoverage`,
              defaultRendering: 'snpcoverage',
              type: `SNPCoverageTrack`,
            },
            type: 'SNPCoverageTrack',
          },
        }
        // console.log('AFTER')
        // console.log(JSON.stringify(ret, 0, 2))
        return ret
      }),
  )
}
