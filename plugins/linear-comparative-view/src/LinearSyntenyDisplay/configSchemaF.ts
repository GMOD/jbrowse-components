import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import baseConfigFactory from '../LinearComparativeDisplay/configSchemaF'

/**
 * #config LinearSyntenyDisplay
 */
function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearSyntenyDisplay',
    {
      /**
       * #slot
       * currently unused
       */
      middle: { defaultValue: true, type: 'boolean' },

      /**
       * #slot
       * currently unused
       */
      trackIds: {
        defaultValue: [],
        type: 'stringArray',
      },
    },
    {
      /**
       * #baseConfiguration
       * this refers to the LinearComparativeDisplay
       */
      baseConfiguration: baseConfigFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export default configSchemaFactory
