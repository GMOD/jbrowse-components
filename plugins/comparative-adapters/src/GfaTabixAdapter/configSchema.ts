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
    assemblyNameMap: {
      type: 'frozen',
      defaultValue: {} as Record<string, string>,
      description:
        'Map from file genome names (e.g. GRCh38#0) to JBrowse assembly names (e.g. hg38)',
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
    segmentsLocation: {
      type: 'fileLocation',
      description:
        'Location of the segs.gz file (segment → position reverse index)',
      defaultValue: {
        uri: '/path/to/data.segments.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    segmentsGziLocation: {
      type: 'fileLocation',
      description: 'Location of the segs.gz.gzi bgzip index',
      defaultValue: {
        uri: '/path/to/data.segments.gz.gzi',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    segmentsIdxLocation: {
      type: 'fileLocation',
      description:
        'Location of the segs.idx companion index (segment ID → byte offset)',
      defaultValue: {
        uri: '/path/to/data.segments.idx',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    alnLocation: {
      type: 'fileLocation',
      description:
        'Location of the aln.bed.gz file (precomputed pairwise alignments with cs tags)',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    alnIndex: ConfigurationSchema('AlnTabixIndex', {
      /**
       * #slot alnIndex.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '',
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
     *   "prefix": "https://example.com/data/pangenome"
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
          segmentsLocation: {
            uri: `${snap.prefix}.segments.gz`,
            baseUri: snap.baseUri,
          },
          segmentsGziLocation: {
            uri: `${snap.prefix}.segments.gz.gzi`,
            baseUri: snap.baseUri,
          },
          segmentsIdxLocation: {
            uri: `${snap.prefix}.segments.idx`,
            baseUri: snap.baseUri,
          },
          alnLocation: {
            uri: `${snap.prefix}.aln.bed.gz`,
            baseUri: snap.baseUri,
          },
          alnIndex: {
            location: {
              uri: `${snap.prefix}.aln.bed.gz.tbi`,
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
