import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const DivSequenceRenderer = ConfigurationSchema(
  'DivSequenceRenderer',
  {
    /**
     * !slot
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
