import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay
 * #category display
 * extends LinearWiggleDisplay
 */
export default function WiggleConfigFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {
      windowDelta: {
        defaultValue: 100,
        type: 'number',
      },
      windowSize: {
        defaultValue: 100,
        type: 'number',
      },
    },
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
