import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config BgzipFastaAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BgzipFastaAdapter = ConfigurationSchema(
  'BgzipFastaAdapter',
  {
    /**
     * #slot
     */
    faiLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/seq.fa.gz.fai',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    fastaLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/seq.fa.gz' },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    gziLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/seq.fa.gz.gzi',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    metadataLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/fa.metadata.yaml',
      },
      description: 'Optional metadata file',
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)
export default BgzipFastaAdapter
