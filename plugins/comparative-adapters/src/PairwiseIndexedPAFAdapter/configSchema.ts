import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config PairwiseIndexedPAFAdapter
 * #trackType SyntenyTrack
 * #fileFormat synteny | Indexed PAF (PIF) | Built by `jbrowse make-pif`; fetches only the visible region
 * a tabix-indexed PAF (PIF) for large synteny datasets. The `uri` shorthand
 * auto-resolves the `.tbi` index (pass `csi: true` for a `.csi` index).
 *
 * #example
 * ```js
 * {
 *   type: 'PairwiseIndexedPAFAdapter',
 *   uri: 'https://example.com/aln.pif.gz',
 *   queryAssembly: 'hg19',
 *   targetAssembly: 'hg38',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        pifGzLocation: {
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
}

const PairwiseIndexedPAFAdapter = ConfigurationSchema(
  'PairwiseIndexedPAFAdapter',
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
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    },
    /**
     * #slot
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    },
    /**
     * #slot
     */
    pifGzLocation: {
      type: 'fileLocation',
      description: 'location of pairwise tabix indexed PAF (pif)',
      defaultValue: {
        uri: '/path/to/data/file.pif.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * bpPerPx threshold at which the reader switches from the per-row
     * CIGAR tier (lowercase t/q prefix) to the coarse no-CIGAR tier
     * (uppercase T/Q prefix), when make-pif was run with --coarse.
     * No coarse tier present in the file = always uses fine tier.
     */
    coarseBpPerPxThreshold: {
      type: 'number',
      defaultValue: 10000,
      advanced: true,
    },
    /**
     * #slot
     */
    index: ConfigurationSchema('TabixIndex', {
      /**
       * #slot index.indexType
       */
      indexType: {
        model: types.enumeration('IndexType', ['TBI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'TBI',
      },
      /**
       * #slot index.location
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.paf.gz.tbi',
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
     *
     * preprocessor to allow minimal config, assumes file.pif.gz.tbi:
     * ```json
     * {
     *   "type": "PairwiseIndexedPAFAdapter",
     *   "uri": "file.pif.gz",
     *   "queryAssembly": "hg19",
     *   "targetAssembly": "hg38"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type PairwiseIndexedPAFAdapterConfig = Instance<
  typeof PairwiseIndexedPAFAdapter
>

export default PairwiseIndexedPAFAdapter
