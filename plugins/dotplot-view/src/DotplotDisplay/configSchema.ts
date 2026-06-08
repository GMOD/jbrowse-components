import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config DotplotDisplay
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'DotplotDisplay',
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
