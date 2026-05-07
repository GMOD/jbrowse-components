import { ConfigurationSchema } from '@jbrowse/core/configuration'

import baseConfigSchemaFactory from './baseConfigSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {},
    {
      baseConfiguration: baseConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
