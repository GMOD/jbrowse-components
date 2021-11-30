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
      maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 0.5,
      },
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
