import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

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
       */
      height: {
        type: 'number',
        defaultValue: 250,
      },
      /**
       * #slot
       */
      lineZoneHeight: {
        type: 'number',
        defaultValue: 30,
        description:
          'Height of the zone showing lines connecting LD matrix to genomic positions',
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
