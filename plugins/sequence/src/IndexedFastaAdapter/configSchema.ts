import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config IndexedFastaAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const IndexedFastaAdapter = ConfigurationSchema(
  'IndexedFastaAdapter',
  {
    /**
     * #slot
     */
    faiLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/seq.fa.fai' },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    fastaLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/seq.fa' },
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
export default IndexedFastaAdapter
