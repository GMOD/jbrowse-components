import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

export { default as modelFactory } from './model'
export { default as ReactComponent } from './components/LinearFilteringDisplay'

export function configSchemaFactory(pluginManager) {
  return ConfigurationSchema(
    'LinearFilteringDisplay',
    {
      filterAttributes: {
        type: 'stringArray',
        defaultValue: ['type'],
        description: 'list of feature attributes to use for filtering',
      },
    },
    {
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
