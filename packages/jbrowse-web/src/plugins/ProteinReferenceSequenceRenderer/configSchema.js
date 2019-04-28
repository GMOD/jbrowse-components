import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'ProteinReferenceSequenceRenderer',
  {
    height: {
      type: 'number',
      description: 'height in pixels of each line of sequence',
      defaultValue: 16,
    },
  },
  { explicitlyTyped: true },
)
