import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SNPCoverageAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'SNPCoverageAdapter',
  {
    /**
     * #slot
     * normally refers to a BAM or CRAM adapter
     */
    subadapter: {
      type: 'frozen',
      defaultValue: null,
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
