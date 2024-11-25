import { ConfigurationSchema } from '@jbrowse/core/configuration'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay
 * #category display
 * extends LinearWiggleDisplay
 */
export default function LinearGCContentDisplay(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      windowDelta: {
        type: 'number',
        defaultValue: 100,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')!
        .configSchema,
      explicitlyTyped: true,
    },
  )
}
