import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config MultiWiggleAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const MultiWiggleAdapter = ConfigurationSchema(
  'MultiWiggleAdapter',
  {
    /**
     * #slot
     */
    subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    },
    /**
     * #slot
     */
    bigWigs: {
      type: 'frozen',
      description:
        'array of bigwig filenames, alternative to the subadapters slot',
      defaultValue: [],
    },
  },
  { explicitlyTyped: true },
)

export default MultiWiggleAdapter
