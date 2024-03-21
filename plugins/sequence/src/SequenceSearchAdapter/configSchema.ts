import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config SequenceSearchAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const configSchema = ConfigurationSchema(
  'SequenceSearchAdapter',
  {
    /**
     * #slot
     */
    caseInsensitive: {
      defaultValue: true,
      type: 'boolean',
    },

    /**
     * #slot
     */
    search: {
      defaultValue: '',
      description: 'Search string or regex to search for',
      type: 'string',
    },

    /**
     * #slot
     */
    searchForward: {
      defaultValue: true,
      type: 'boolean',
    },

    /**
     * #slot
     */
    searchReverse: {
      defaultValue: true,
      type: 'boolean',
    },

    /**
     * #slot
     */
    sequenceAdapter: {
      defaultValue: null,
      type: 'frozen',
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
