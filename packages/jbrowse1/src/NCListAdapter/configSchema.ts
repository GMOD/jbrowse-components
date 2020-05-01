import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'NCListAdapter',
  {
    rootUrlTemplate: {
      type: 'string',
      defaultValue: '/path/to/my/{refseq}/trackData.json',
    },
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    },
  },
  { explicitlyTyped: true },
)
