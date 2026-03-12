import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config LinearSyntenyDisplay
 */
function configSchemaFactory() {
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
      middle: {
        type: 'boolean',
        defaultValue: true,
      },
    },
    {
      explicitlyTyped: true,
      explicitIdentifier: 'displayId',
    },
  )
}

export default configSchemaFactory
