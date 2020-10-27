import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { basicTrackConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

export { default as modelFactory } from './model'
export { default as ReactComponent } from './components/FilteringTrack'

export function configSchemaFactory(pluginManager) {
  return ConfigurationSchema(
    'FilteringTrack',
    {
      filterAttributes: {
        type: 'stringArray',
        defaultValue: ['type'],
        description: 'list of feature attributes to use for filtering',
      },
    },
    {
      baseConfiguration: basicTrackConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
