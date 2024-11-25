import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

/**
 * #config Gff3TabixAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const Gff3TabixAdapter = ConfigurationSchema(
  'Gff3TabixAdapter',
  {
    /**
     * #slot
     */
    gffGzLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff.gz', locationType: 'UriLocation' },
    },

    index: ConfigurationSchema('Gff3TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.indexType
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.gff.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     * the Gff3TabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we requested.
     * you can disable this for certain feature types to avoid fetching e.g. the
     * entire chromosome
     */
    dontRedispatch: {
      type: 'stringArray',
      defaultValue: ['chromosome', 'region', 'contig'],
    },
  },
  { explicitlyTyped: true },
)

export default Gff3TabixAdapter
