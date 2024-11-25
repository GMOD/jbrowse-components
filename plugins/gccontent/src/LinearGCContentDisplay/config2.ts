import { ConfigurationSchema } from '@jbrowse/core/configuration'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearGCContentTrackDisplay
 * #category display
 * extends LinearWiggleDisplay, used specifically for GCContentTrack
 */
export default function LinearGCContentTrackDisplayF(
  pluginManager: PluginManager,
) {
  return ConfigurationSchema(
    'LinearGCContentTrackDisplay',
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
