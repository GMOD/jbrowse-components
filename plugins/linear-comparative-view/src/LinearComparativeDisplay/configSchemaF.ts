import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearComparativeDisplay
 */
function configSchemaFactory(_pluginManager: any) {
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
