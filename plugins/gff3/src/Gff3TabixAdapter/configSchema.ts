import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
     * the Gff3TabixAdapter has to "redispatch" if it fetches a region and
     * features it finds inside that region extend outside the region we requested.
     * you can disable this for certain feature types to avoid fetching e.g. the
     * entire chromosome
     */
    dontRedispatch: {
      defaultValue: ['chromosome', 'region'],
      type: 'stringArray',
    },

    /**
     * #slot
     */
    gffGzLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.gff.gz' },
      type: 'fileLocation',
    },

    index: ConfigurationSchema('Gff3TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        defaultValue: 'TBI',
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
      },
      /**
       * #slot index.indexType
       */
      location: {
        defaultValue: {
          locationType: 'UriLocation',
          uri: '/path/to/my.gff.gz.tbi',
        },
        type: 'fileLocation',
      },
    }),
  },
  { explicitlyTyped: true },
)

export default Gff3TabixAdapter
