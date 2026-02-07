import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearWebGLFeatureDisplay',
    {
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description: 'Maximum height of the display in pixels',
      },
    },
    {
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
