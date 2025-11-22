import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from '../MultiLinearVariantIntrogressionRenderer/configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'MultiLinearVariantIntrogressionDisplay',
    {
      renderer: configSchema,
      height: {
        type: 'number',
        defaultValue: 250,
      },
    },
    {
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
