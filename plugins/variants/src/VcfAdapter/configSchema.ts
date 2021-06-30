import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'VcfAdapter',
  {
    vcfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf' },
    },
  },
  { explicitlyTyped: true },
)
