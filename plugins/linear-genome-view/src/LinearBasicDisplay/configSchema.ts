import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay'

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {
      mouseover: {
        type: 'string',
        description: 'what to display in a given mouseover',
        defaultValue: `function(feature) {
  return feature.get('name')
}`,
        functionSignature: ['feature'],
      },
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
