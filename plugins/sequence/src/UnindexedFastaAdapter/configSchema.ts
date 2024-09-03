import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config UnindexedFastaAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const UnindexedFastaAdapter = ConfigurationSchema(
  'UnindexedFastaAdapter',
  {
    rewriteRefNames: {
      type: 'string',
      defaultValue: '',
      contextVariable: ['refName'],
    },
    /**
     * #slot
     */
    fastaLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/seq.fa',
        locationType: 'UriLocation',
      },
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
export default UnindexedFastaAdapter
