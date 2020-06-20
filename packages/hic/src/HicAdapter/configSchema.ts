import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export default ConfigurationSchema(
  'HicAdapter',
  {
    hicLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.hic' },
    },
  },
  { explicitlyTyped: true },
)
