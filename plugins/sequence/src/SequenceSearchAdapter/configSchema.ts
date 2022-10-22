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
    search: {
      type: 'string',
      defaultValue: '',
      description: 'Search string or regex to search for',
    },
    /**
     * #slot
     */
    sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    },
    /**
     * #slot
     */
    searchForward: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     */
    searchReverse: {
      type: 'boolean',
      defaultValue: true,
    },
    /**
     * #slot
     */
    caseInsensitive: {
      type: 'boolean',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
