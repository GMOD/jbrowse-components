import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearLollipopDisplay',
    { renderer: pluginManager.pluggableConfigSchemaType('renderer') },
    {
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
