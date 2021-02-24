import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearFeatureDisplay',
    {
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
      // overrides base
      maxDisplayedBpPerPx: {
        type: 'number',
        description: 'maximum bpPerPx that is displayed in the view',
        defaultValue: 1000,
      },
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
