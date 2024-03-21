import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config FromConfigSequenceAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const sequenceConfigSchema = ConfigurationSchema(
  'FromConfigSequenceAdapter',
  {
    /**
     * #slot
     */
    features: {
      defaultValue: [],
      type: 'frozen',
    },
  },
  { explicitlyTyped: true, implicitIdentifier: 'adapterId' },
)

export default sequenceConfigSchema
