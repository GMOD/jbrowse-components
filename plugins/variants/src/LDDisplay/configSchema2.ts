import { ConfigurationSchema } from '@jbrowse/core/configuration'

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import configSchema from '../LDRenderer/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LDTrackDisplay
 * Display configuration for pre-computed LD data on LDTrack
 * extends
 * - [SharedLDDisplay](../sharedlddisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LDTrackDisplay',
    {
      /**
       * #slot
       * LDRenderer
       */
      renderer: configSchema,
      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 400,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedLDConfigFactory(),
      explicitlyTyped: true,
    },
  )
}
