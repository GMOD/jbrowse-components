/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearComparativeDisplay
 */
function configSchemaFactory(_pluginManager: any) {
  return ConfigurationSchema(
    'LinearComparativeDisplay',
    {},
    {
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',

      explicitlyTyped: true,
    },
  )
}

export default configSchemaFactory
