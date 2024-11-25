import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearLollipopDisplay
 */
export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearLollipopDisplay',
    {
      /**
       * #slot
       */
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
