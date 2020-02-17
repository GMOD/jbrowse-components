import { types } from 'mobx-state-tree'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import {
  configSchemaFactory as baseConfig,
  stateModelFactory as baseModel,
} from '../LinearComparativeTrack'

export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {},
    {
      baseConfiguration: baseConfig(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types.compose(
    baseModel(pluginManager, configSchema),
    types.model('LinearSyntenyTrack', {
      type: types.literal('LinearSyntenyTrack'),
      configuration: ConfigurationReference(configSchema),
    }),
  )
}
