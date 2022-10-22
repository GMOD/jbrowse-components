import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config VcfAdapter
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
  /**
   * !config VcfAdapter
   */
  { explicitlyTyped: true },
)

export default VcfAdapter
