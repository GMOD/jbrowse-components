import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config AllVsAllPAFAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const AllVsAllPAFAdapter = ConfigurationSchema(
  'AllVsAllPAFAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
    },
    /**
     * #slot
     * can be optionally gzipped
     */
    pafLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.paf',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config:
     * ```json
     * {
     *   "type": "AllVsAllPAFAdapter",
     *   "uri": "file.paf.gz"
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            pafLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
          }
        : snap
    },
  },
)

export default AllVsAllPAFAdapter
