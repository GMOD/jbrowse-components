import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearComparativeDisplay
 */
function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearComparativeDisplay',
    {},
    {
      explicitlyTyped: true,

      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
    },
  )
}

export default configSchemaFactory
