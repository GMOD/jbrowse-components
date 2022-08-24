import { ConfigurationSchema } from '@jbrowse/core/configuration'

const configSchema = ConfigurationSchema(
  'SequenceSearchAdapter',
  {
    search: {
      type: 'string',
      defaultValue: '',
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
  },
  { explicitlyTyped: true },
)

export default configSchema
