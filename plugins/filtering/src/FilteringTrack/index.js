import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { basicTrackConfigSchemaFactory } from '@gmod/jbrowse-plugin-linear-genome-view'

export { default as modelFactory } from './model'

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
