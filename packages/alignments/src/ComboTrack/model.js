import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import wiggleStateModelFactory from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/model'

export default (pluginManager, configSchema) =>
  types.compose(
    'ComboTrack',
    blockBasedTrackModel,
    types.model({
      AlignmentsTrack: blockBasedTrackModel,
      SNPCoverageTrack: wiggleStateModelFactory(configSchema),
    }),
    types.model({
      type: types.literal('ComboTrack'),
      configuration: ConfigurationReference(configSchema),
    }),
  )
