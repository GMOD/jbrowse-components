import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@gmod/jbrowse-core/configuration/configurationSchema'

export default (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'HicTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('HicTrack'),
        configuration: ConfigurationReference(configSchema),
        height: types.optional(types.integer, 100),
      }),
    )
    .views(self => ({
      get blockType() {
        return 'dynamicBlocks'
      },
    }))
