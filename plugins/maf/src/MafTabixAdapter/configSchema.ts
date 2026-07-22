import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config MafTabixAdapter
 * #trackType MafTrack
 * #fileFormat maf | MAF (tabix)
 */

const configSchema = ConfigurationSchema(
  'MafTabixAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description: 'string[] or {id:string,label:string,color?:string}[]',
      defaultValue: [],
    },
    /**
     * #slot
     */
    bedGzLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bed.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    refAssemblyName: {
      type: 'string',
      defaultValue: '',
    },
    index: ConfigurationSchema('Index', {
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bed.gz.tbi',
        },
      },
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
    }),
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    annotationAdapter: {
      type: 'frozen',
      description:
        'optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it',
      defaultValue: null,
    },
  },
  {
    explicitlyTyped: true,
    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes tbi index at
     * yourfile.bed.gz.tbi:
     *
     * ```json
     * {
     *   "type": "MafTabixAdapter",
     *   "uri": "yourfile.bed.gz",
     *   "samples": ["sample1", "sample2"]
     * }
     * ```
     */
    preProcessSnapshot: snap => {
      return snap.uri
        ? {
            ...snap,
            ...(snap.nhUri
              ? {
                  nhLocation: {
                    uri: snap.nhUri,
                    baseUri: snap.baseUri,
                  },
                }
              : {}),
            bedGzLocation: {
              uri: snap.uri,
              baseUri: snap.baseUri,
            },
            index: {
              indexType: snap.csi ? 'CSI' : 'TBI',
              location: {
                uri: `${snap.uri}.${snap.csi ? 'csi' : 'tbi'}`,
                baseUri: snap.baseUri,
              },
            },
          }
        : snap
    },
  },
)

export type MafTabixAdapterConfig = Instance<typeof configSchema>

export default configSchema
