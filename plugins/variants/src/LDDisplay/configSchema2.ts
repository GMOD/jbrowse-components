import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from '../LDRenderer/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LDTrackDisplay
 * Display configuration for pre-computed LD data on LDTrack
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(pluginManager: PluginManager) {
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
        defaultValue: 250,
      },
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}
