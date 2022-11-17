import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearPileupDisplayConfigSchemaFactory } from '@jbrowse/plugin-alignments'

/**
 * #config LGVSyntenyDisplay
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
