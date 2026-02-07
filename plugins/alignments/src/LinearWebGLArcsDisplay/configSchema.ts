import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearWebGLArcsDisplay',
    {
      colorBy: {
        type: 'frozen',
        defaultValue: { type: 'insertSizeAndOrientation' },
        description: 'Color scheme for arcs',
      },
      filterBy: {
        type: 'frozen',
        defaultValue: {},
        description: 'Filters for reads',
      },
      lineWidth: {
        type: 'number',
        defaultValue: 1,
        description: 'Width of arc lines',
      },
    },
    {
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
