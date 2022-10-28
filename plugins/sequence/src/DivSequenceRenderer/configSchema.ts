import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config DivSequenceRenderer
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const DivSequenceRenderer = ConfigurationSchema(
  'DivSequenceRenderer',
  {
    /**
     * #slot
     */
    height: {
      type: 'number',
      description: 'height in pixels of each line of sequence',
      defaultValue: 16,
    },
  },
  { explicitlyTyped: true },
)

export default DivSequenceRenderer
