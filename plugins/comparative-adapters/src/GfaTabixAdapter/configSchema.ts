import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GfaTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GfaTabixAdapter = ConfigurationSchema(
  'GfaTabixAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names (genome sample names from GFA paths)',
    },
    /**
     * #slot
     */
    posLocation: {
      type: 'fileLocation',
      description:
        'Location of the pos.bed.gz file (position → segment mapping)',
      defaultValue: {
        uri: '/path/to/data.pos.bed.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    posIndex: ConfigurationSchema('PosTabixIndex', {
      /**
       * #slot posIndex.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/data.pos.bed.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    /**
     * #slot
     */
    segsLocation: {
      type: 'fileLocation',
      description:
        'Location of the segs.bed.gz file (segment → position mapping)',
      defaultValue: {
        uri: '/path/to/data.segs.bed.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    segsIndex: ConfigurationSchema('SegsTabixIndex', {
      /**
       * #slot segsIndex.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/data.segs.bed.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * Preprocessor for minimal config using prefix:
     * ```json
     * {
     *   "type": "GfaTabixAdapter",
     *   "prefix": "https://example.com/data/pangenome",
     *   "assemblyNames": ["ref#1", "sample1#1"]
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      if (snap.prefix) {
        return {
          ...snap,
          posLocation: {
            uri: `${snap.prefix}.pos.bed.gz`,
            baseUri: snap.baseUri,
          },
          posIndex: {
            location: {
              uri: `${snap.prefix}.pos.bed.gz.tbi`,
              baseUri: snap.baseUri,
            },
          },
          segsLocation: {
            uri: `${snap.prefix}.segs.bed.gz`,
            baseUri: snap.baseUri,
          },
          segsIndex: {
            location: {
              uri: `${snap.prefix}.segs.bed.gz.tbi`,
              baseUri: snap.baseUri,
            },
          },
        }
      }
      return snap
    },
  },
)

export default GfaTabixAdapter
