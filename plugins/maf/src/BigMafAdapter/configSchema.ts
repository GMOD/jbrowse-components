import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config BigMafAdapter
 * used to configure BigMaf adapter
 */

const configSchema = ConfigurationSchema(
  'BigMafAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description: 'string[] or {id:string,label:string,color?:string}[]',
      defaultValue: [],
    },
    /**
     * #slot
     */
    bigBedLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bb',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    summaryAdapter: {
      type: 'frozen',
      description:
        'optional swappable sub-adapter (e.g. a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it',
      defaultValue: null,
    },
  },
  { explicitlyTyped: true },
)

export default configSchema
