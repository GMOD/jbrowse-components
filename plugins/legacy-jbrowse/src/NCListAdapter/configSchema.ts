import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'NCListAdapter',
  {
    rootUrlTemplate: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my/{refseq}/trackData.json',
        locationType: 'UriLocation',
      },
    },
    refNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'List of refNames used by the NCList used for aliasing',
    },
  },
  { explicitlyTyped: true },
)
