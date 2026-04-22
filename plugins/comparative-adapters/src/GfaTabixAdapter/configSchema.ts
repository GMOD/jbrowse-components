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
      defaultValue: {},
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
      description: 'Location of the segments.bin file (binary segment records)',
      defaultValue: {
        uri: '/path/to/data.segments.bin',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    segmentsIdxLocation: {
      type: 'fileLocation',
      description:
        'Location of the segments.idx companion index (segment ID → byte offset)',
      defaultValue: {
        uri: '/path/to/data.segments.idx',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    edgesLocation: {
      type: 'fileLocation',
      description:
        'Location of the edges.bin file (graph adjacency lists for subgraph extraction)',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
    },
    edgesIdxLocation: {
      type: 'fileLocation',
      description:
        'Location of the edges.idx companion index (ordinal → byte offset in edges.bin)',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
    },
    bubblesLocation: {
      type: 'fileLocation',
      description:
        'Location of the bubbles.bed.gz file (precomputed per-snarl CS between allele pairs)',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    bubblesIndex: ConfigurationSchema('BubblesTabixIndex', {
      /**
       * #slot bubblesIndex.location
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
            uri: `${snap.prefix}.segments.bin`,
            baseUri: snap.baseUri,
          },
          segmentsIdxLocation: {
            uri: `${snap.prefix}.segments.idx`,
            baseUri: snap.baseUri,
          },
          edgesLocation: {
            uri: `${snap.prefix}.edges.bin`,
            baseUri: snap.baseUri,
          },
          edgesIdxLocation: {
            uri: `${snap.prefix}.edges.idx`,
            baseUri: snap.baseUri,
          },
          bubblesLocation: {
            uri: `${snap.prefix}.bubbles.bed.gz`,
            baseUri: snap.baseUri,
          },
          bubblesIndex: {
            location: {
              uri: `${snap.prefix}.bubbles.bed.gz.tbi`,
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
