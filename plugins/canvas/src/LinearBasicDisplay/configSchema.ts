import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

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
      color1: {
        type: 'color',
        description: 'the main color of each feature',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      },
      color2: {
        type: 'color',
        description:
          'the secondary color of each feature, used for connecting lines',
        defaultValue: '#f0f',
        contextVariable: ['feature'],
      },
      color3: {
        type: 'color',
        description: 'the tertiary color of each feature, used for UTRs',
        defaultValue: '#357089',
        contextVariable: ['feature'],
      },
      featureHeight: {
        type: 'number',
        description: 'height in pixels of the main body of each feature',
        defaultValue: 10,
        contextVariable: ['feature'],
      },
    },
    {
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
