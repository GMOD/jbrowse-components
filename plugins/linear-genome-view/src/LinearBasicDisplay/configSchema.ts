import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {
      mouseover: {
        type: 'string',
        description: 'what to display in a given mouseover',
        defaultValue: `jexl:get(feature,'name')`,

        contextVariable: ['feature'],
      },
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
