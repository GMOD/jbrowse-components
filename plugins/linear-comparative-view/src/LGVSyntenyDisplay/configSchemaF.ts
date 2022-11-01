import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'

/**
 * #config LGVSyntenyDisplay
 */
function configSchemaF(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LGVSyntenyDisplay',
    {},
    {
      /**
       * #derives
       */
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaF
