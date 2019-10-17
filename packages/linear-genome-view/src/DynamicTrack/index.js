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

export const stateModelFactory = (pluginManager, configSchema) =>
  types.compose(
    'DynamicTrack',
    basicTrackStateModelFactory(pluginManager, configSchema),
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
