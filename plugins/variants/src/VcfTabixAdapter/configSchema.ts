import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config VcfTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const VcfTabixAdapter = ConfigurationSchema(
  'VcfTabixAdapter',
  {
    index: ConfigurationSchema('VcfIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      },
      /**
       * #slot index.location
       */
      location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.vcf.gz.tbi',
        },
        type: 'fileLocation',
      },
    }),
    /**
     * #slot
     */
    vcfGzLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.vcf.gz' },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default VcfTabixAdapter
