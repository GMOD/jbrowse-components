import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'MultiLinearBasicDisplay',
    {
      maxHeight: {
        type: 'number',
        defaultValue: 1200,
      },
      maxFeatureScreenDensity: {
        type: 'number',
        defaultValue: 5,
      },
      autoHeight: {
        type: 'boolean',
        defaultValue: true,
      },
      laneField: {
        type: 'string',
        description:
          'Feature attribute used to assign each feature to a lane (default "source")',
        defaultValue: 'source',
      },
      laneHeight: {
        type: 'number',
        description: 'Height in pixels of each per-sample lane',
        defaultValue: 14,
      },
      laneGap: {
        type: 'number',
        description: 'Gap in pixels between lanes',
        defaultValue: 2,
      },
      color: {
        type: 'color',
        description: 'Color of each feature box',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      },
    },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
