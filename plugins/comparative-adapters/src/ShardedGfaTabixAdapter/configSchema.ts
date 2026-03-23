import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config ShardedGfaTabixAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const ShardedGfaTabixAdapter = ConfigurationSchema(
  'ShardedGfaTabixAdapter',
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
    posIndex: ConfigurationSchema('ShardedPosTabixIndex', {
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
    segmentsManifestLocation: {
      type: 'fileLocation',
      description:
        'Location of the segments manifest JSON (maps genomes to shard files)',
      defaultValue: {
        uri: '/path/to/data.segments.manifest.json',
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
    alnIndex: ConfigurationSchema('ShardedAlnTabixIndex', {
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
          segmentsManifestLocation: {
            uri: `${snap.prefix}.segments.manifest.json`,
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

export default ShardedGfaTabixAdapter
