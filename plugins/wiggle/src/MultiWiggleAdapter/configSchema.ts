import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const MultiWiggleAdapter = ConfigurationSchema(
  'MultiWiggleAdapter',
  {
    /**
     * !slot
     */
    subadapters: {
      type: 'frozen',
      defaultValue: [],
      description: 'array of subadapter JSON objects',
    },
    /**
     * !slot
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
