import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay
 */
export default function WiggleConfigFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')
        .configSchema,
      explicitlyTyped: true,
    },
  )
}
