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
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa', locationType: 'UriLocation' },
    },
    /**
     * #slot
     */
    faiLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/seq.fa.fai', locationType: 'UriLocation' },
    },
    /**
     * #slot
     */
    metadataLocation: {
      description: 'Optional metadata file',
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/fa.metadata.yaml',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)
export default IndexedFastaAdapter
