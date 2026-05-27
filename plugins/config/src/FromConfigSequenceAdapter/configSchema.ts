import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FromConfigSequenceAdapter
 */

const sequenceConfigSchema = ConfigurationSchema(
  'FromConfigSequenceAdapter',
  {
    /**
     * #slot
     */
    features: {
      type: 'frozen',
      defaultValue: [],
    },
  },
  {
    explicitlyTyped: true,
  },
)

export default sequenceConfigSchema
