/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearComparativeDisplay
 */
function configSchemaFactory(pluginManager: any) {
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
