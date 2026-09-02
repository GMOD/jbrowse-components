import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'
import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

// #region preProcess
export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        bamLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        index: {
          indexType: snap.csi ? 'CSI' : 'BAI',
          location: {
            uri: `${snap.uri}.${snap.csi ? 'csi' : 'bai'}`,
            baseUri: snap.baseUri,
          },
        },
      }
    : snap
}
// #endregion

/**
 * #config BamAdapter
 * #trackType AlignmentsTrack
 * #fileFormat alignments | BAM
 * used to configure BAM adapter
 *
 * Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
 * automatically supplies it from the enclosing assembly's sequence track.
 *
 * #example
 * The `uri` shorthand auto-resolves the `.bai` index (pass `csi: true` for a
 * `.csi` index). For a differently-named index, set `index` explicitly with
 * the full slot form:
 * ```js
 * {
 *   type: 'BamAdapter',
 *   uri: 'https://example.com/sample.bam',
 * }
 * ```
 */
const configSchema = ConfigurationSchema(
  'BamAdapter',
  {
    // #region nesting
    /**
     * #slot
     * location of the BAM file. Per-base mismatches come from the record's MD
     * tag when it has one, and are otherwise computed against the assembly's
     * reference sequence.
     */
    bamLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.bam',
        locationType: 'UriLocation',
      },
    },

    index: ConfigurationSchema('BamIndex', {
      /**
       * #slot index.indexType
       * `BAI` is the usual `samtools index` output. `CSI` is required for a
       * reference longer than 512 Mb, which BAI cannot address.
       */
      indexType: {
        model: types.enumeration('IndexType', ['BAI', 'CSI']),
        type: 'stringEnum',
        defaultValue: 'BAI',
      },
      /**
       * #slot index.location
       * location of the index. Only needed when it is not named
       * `<file>.bam.bai` (or `.bam.csi`), which is what the `uri` shorthand
       * assumes.
       */
      location: {
        type: 'fileLocation',
        defaultValue: {
          uri: '/path/to/my.bam.bai',
          locationType: 'UriLocation',
        },
      },
    }),
    // #endregion
    /**
     * #slot
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size to fetch in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
      advanced: true,
    },
    /**
     * #slot useBgzfWorkerPool
     */
    // On by default, matching @gmod/bam. The slot exists so the pool can be
    // turned off without rebuilding — which is how its effect on a real track
    // gets measured, since the inflate happens in an RPC worker where no test
    // hook reaches. Mirrors CramAdapter's useSliceWorkerPool.
    useBgzfWorkerPool: {
      type: 'boolean',
      description:
        'inflate BGZF blocks on a pool of workers rather than in the thread that asked',
      defaultValue: true,
      advanced: true,
    },
    ...densityAdapterConfigSchemaFields,
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow minimal config, assumes yourfile.bam.bai:
     * ```json
     * {
     *   "type": "BamAdapter",
     *   "uri": "yourfile.bam"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type BamAdapterConfig = Instance<typeof configSchema>
export default configSchema
