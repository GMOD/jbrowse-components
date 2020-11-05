import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import PluginManager from '@jbrowse/core/PluginManager'

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
