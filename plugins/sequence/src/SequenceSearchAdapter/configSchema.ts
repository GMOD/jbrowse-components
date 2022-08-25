import { ConfigurationSchema } from '@jbrowse/core/configuration'

const configSchema = ConfigurationSchema(
  'SequenceSearchAdapter',
  {
    search: {
      type: 'string',
      defaultValue: '',
      description: 'Search string or regex to search for',
    },
    sequenceAdapter: {
      type: 'frozen',
      defaultValue: null,
    },
    searchForward: {
      type: 'boolean',
      defaultValue: true,
    },
    searchReverse: {
      type: 'boolean',
      defaultValue: true,
    },
    caseInsensitive: {
      type: 'boolean',
      defaultValue: true,
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
