import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from '../LDRenderer/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LDDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LDDisplay',
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
