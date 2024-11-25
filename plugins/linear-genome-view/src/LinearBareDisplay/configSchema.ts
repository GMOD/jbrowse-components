import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearBareDisplay
 * #category display
 */
function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBareDisplay',
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

export { configSchemaFactory }
