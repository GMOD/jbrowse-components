import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'
import {
  configSchemaFactory as basicTrackConfigSchemaFactory,
  stateModelFactory as basicTrackStateModelFactory,
} from '../BasicTrack'

export function configSchemaFactory(pluginManager) {
  const basicTrackConfigSchema = basicTrackConfigSchemaFactory(pluginManager)
  return ConfigurationSchema(
    'DynamicTrack',
    {},
    { baseConfiguration: basicTrackConfigSchema, explicitlyTyped: true },
  )
}

export function stateModelFactory(configSchema) {
  const basicTrackStateModel = basicTrackStateModelFactory(configSchema)
  // a DynamicTrack is just a BasicTrack but with blockType hardcoded to 'dynamicBlocks'
  return types.compose(
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
        get renderDelay() {
          return 500
        },
      })),
  )
}
