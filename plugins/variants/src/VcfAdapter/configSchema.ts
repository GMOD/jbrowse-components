import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config VcfAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const VcfAdapter = ConfigurationSchema(
  'VcfAdapter',
  {
    /**
     * #slot
     */
    vcfLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.vcf' },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default VcfAdapter
