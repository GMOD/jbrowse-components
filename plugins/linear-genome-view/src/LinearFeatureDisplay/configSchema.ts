import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearFeatureDisplay
 * #category display
 */
function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearFeatureDisplay',
    {
      /**
       * #slot
       */
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export default configSchemaFactory
