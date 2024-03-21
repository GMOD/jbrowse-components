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
    bigWigs: {
      defaultValue: [],
      description:
        'array of bigwig filenames, alternative to the subadapters slot',
      type: 'frozen',
    },

    /**
     * #slot
     */
    subadapters: {
      defaultValue: [],
      description: 'array of subadapter JSON objects',
      type: 'frozen',
    },
  },
  { explicitlyTyped: true },
)

export default MultiWiggleAdapter
