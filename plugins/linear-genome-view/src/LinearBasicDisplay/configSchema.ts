import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { baseLinearDisplayConfigSchema } from '../BaseLinearDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearBasicDisplay
 * #category display
 */
function configSchemaFactory(_pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearBasicDisplay',
    {},
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
