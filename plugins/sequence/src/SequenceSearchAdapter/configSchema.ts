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
  },
  { explicitlyTyped: true },
)

export default configSchema
