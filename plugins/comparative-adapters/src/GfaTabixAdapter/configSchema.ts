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
      description: 'Location of pos.bed.gz (position → ordinal mapping)',
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
    syntenyLocation: {
      type: 'fileLocation',
      description:
        'Location of synteny.bed.gz (haplotype alignment blocks, ref-keyed)',
      defaultValue: {
        uri: '/path/to/data.synteny.bed.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    syntenyIndex: ConfigurationSchema('SyntenyTabixIndex', {
      /**
       * #slot syntenyIndex.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/data.synteny.bed.gz.tbi',
          locationType: 'UriLocation',
        },
      },
    }),
    syntenyCoarseLocation: {
      type: 'fileLocation',
      description:
        'Location of synteny.coarse.bed.gz (merged blocks for bpPerPx > 1000)',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
    syntenyCoarseIndex: ConfigurationSchema('SyntenyCoarseTabixIndex', {
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '', locationType: 'UriLocation' },
      },
    }),
    /**
     * #slot
     */
    bubblesLocation: {
      type: 'fileLocation',
      description: 'Location of bubbles.bed.gz (per-snarl CS for bpPerPx < 50)',
      defaultValue: { uri: '', locationType: 'UriLocation' },
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
        defaultValue: { uri: '', locationType: 'UriLocation' },
      },
    }),
    edgesLocation: {
      type: 'fileLocation',
      description:
        'Location of edges.spatial.bed.gz (bidirectional edge index)',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
    edgesIndex: ConfigurationSchema('EdgesTabixIndex', {
      location: {
        type: 'fileLocation',
        defaultValue: { uri: '', locationType: 'UriLocation' },
      },
    }),
    seqlensLocation: {
      type: 'fileLocation',
      description:
        'Location of seglens.bin (flat u32 segment lengths indexed by ordinal)',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * Preprocessor for minimal config using prefix:
     * ```json
     * { "type": "GfaTabixAdapter", "prefix": "https://example.com/data/pan" }
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
          syntenyLocation: {
            uri: `${snap.prefix}.synteny.bed.gz`,
            baseUri: snap.baseUri,
          },
          syntenyIndex: {
            location: {
              uri: `${snap.prefix}.synteny.bed.gz.tbi`,
              baseUri: snap.baseUri,
            },
          },
          syntenyCoarseLocation: {
            uri: `${snap.prefix}.synteny.coarse.bed.gz`,
            baseUri: snap.baseUri,
          },
          syntenyCoarseIndex: {
            location: {
              uri: `${snap.prefix}.synteny.coarse.bed.gz.tbi`,
              baseUri: snap.baseUri,
            },
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
          edgesLocation: {
            uri: `${snap.prefix}.edges.spatial.bed.gz`,
            baseUri: snap.baseUri,
          },
          edgesIndex: {
            location: {
              uri: `${snap.prefix}.edges.spatial.bed.gz.tbi`,
              baseUri: snap.baseUri,
            },
          },
          seqlensLocation: {
            uri: `${snap.prefix}.seglens.bin`,
            baseUri: snap.baseUri,
          },
        }
      }
      return snap
    },
  },
)

export default GfaTabixAdapter
