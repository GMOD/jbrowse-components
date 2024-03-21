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
      defaultValue: 16,
      description: 'height in pixels of each line of sequence',
      type: 'number',
    },
  },
  { explicitlyTyped: true },
)

export default DivSequenceRenderer
