import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearPileupDisplayConfigSchemaFactory } from '@jbrowse/plugin-alignments'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LGVSyntenyDisplay
 * extends config
 * - [LinearPileupDisplay](../linearpileupdisplay)
 */
function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LGVSyntenyDisplay',
    {},
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: linearPileupDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
