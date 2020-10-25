import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'BigWigAdapter',
  {
    bigWigLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.bw' },
    },
  },
  { explicitlyTyped: true },
)
