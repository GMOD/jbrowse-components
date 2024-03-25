import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentDisplay2
 * #category display
 * extends LinearWiggleDisplay, used specifically for GCContentTrack
 */
export default function LinearGCContentDisplay2(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearGCContentDisplay2',
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
      baseConfiguration: pluginManager.getDisplayType('LinearWiggleDisplay')
        .configSchema,
      explicitlyTyped: true,
    },
  )
}
