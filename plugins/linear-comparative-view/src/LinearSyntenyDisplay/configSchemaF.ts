import { ConfigurationSchema } from '@jbrowse/core/configuration'
import baseConfigFactory from '../LinearComparativeDisplay/configSchemaF'
import type PluginManager from '@jbrowse/core/PluginManager'

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
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },

      /**
       * #slot
       * currently unused
       */
      middle: { type: 'boolean', defaultValue: true },
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
