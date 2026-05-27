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
    adapterId: {
      type: 'string',
      defaultValue: '',
    },
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
