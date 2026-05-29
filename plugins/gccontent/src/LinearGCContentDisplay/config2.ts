import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

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
      gcMode: {
        type: 'stringEnum',
        model: types.enumeration('gcMode', ['content', 'skew']),
        defaultValue: 'content',
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
