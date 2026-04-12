import { ConfigurationSchema } from '@jbrowse/core/configuration'

import linearFeatureDisplayConfigSchemaFactory from '../LinearFeatureDisplay/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description: 'Maximum height of the display in pixels',
      },
      autoHeight: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Automatically resize the track height to fit all features',
      },
    },
    {
      baseConfiguration: linearFeatureDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
