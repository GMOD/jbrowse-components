import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const VcfAdapter = ConfigurationSchema(
  'VcfAdapter',
  {
    /**
     * !slot
     */
    vcfLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.vcf', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)

export default VcfAdapter
