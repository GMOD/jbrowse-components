import { types } from 'mobx-state-tree'

import {
  ConfigurationSchema,
  ConfigurationReference,
} from '@gmod/jbrowse-core/configuration'
import BasicTrack from './BasicTrack'

export default pluginManager => {
  const {
    stateModel: basicTrackStateModel,
    configSchema: basicTrackConfigSchema,
  } = BasicTrack(pluginManager)

  const configSchema = ConfigurationSchema(
    'DynamicTrack',
    {},
    { baseConfiguration: basicTrackConfigSchema, explicitlyTyped: true },
  )

  // a DynamicTrack is just a BasicTrack but with blockType hardcoded to 'dynamicBlocks'
  const stateModel = types.compose(
    'DynamicTrack',
    basicTrackStateModel,
    types
      .model({
        type: types.literal('DynamicTrack'),
        configuration: ConfigurationReference(configSchema),
      })
      .views((/* self */) => ({
        get blockType() {
          return 'dynamicBlocks'
        },
      })),
  )

  return { stateModel, configSchema }
}
