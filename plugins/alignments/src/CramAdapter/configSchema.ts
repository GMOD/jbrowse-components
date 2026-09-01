import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'

import type { Instance } from '@jbrowse/mobx-state-tree'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        cramLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
        craiLocation: {
          uri: `${snap.uri}.crai`,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

/**
 * #config CramAdapter
 * #trackType AlignmentsTrack
 * #fileFormat alignments | CRAM
 * `sequenceAdapter` is filled in automatically from the enclosing assembly's
 * sequence track — you never specify it.
 *
 * Reads CRAM alignments, fetching only the containers overlapping the visible
 * region through the `.crai` index. Decoding happens against that assembly's
 * sequence, so it has to be the reference the file was compressed against; a
 * mismatched one isn't rejected, it just decodes into mismatches.
 *
 * #example
 * The `uri` shorthand auto-resolves the `.crai` index:
 * ```js
 * {
 *   type: 'CramAdapter',
 *   uri: 'https://example.com/sample.cram',
 * }
 * ```
 */
const configSchema = ConfigurationSchema(
  'CramAdapter',
  {
    /**
     * #slot fetchSizeLimit
     */
    // 5MB, the same budget BamAdapter declares. It was 3MB, and the difference
    // was never a decision about CRAM — it just made an ordinary window over a
    // deep long-read CRAM banner where the same window over a BAM does not,
    // which is backwards: CRAM is the more compressed of the two, so 3MB of it
    // is MORE alignment data than 3MB of BAM, not less. The number is a warning
    // threshold rather than a cap (the banner offers force-load either way), so
    // matching them costs a slower render on the loci between the two values and
    // buys one budget to reason about.
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 5_000_000,
      advanced: true,
    },
    ...densityAdapterConfigSchemaFields,

    /**
     * #slot useSliceWorkerPool
     */
    // On by default, matching @gmod/cram. The slot exists so the pool can be
    // turned off without rebuilding — which is how its effect on a real track
    // gets measured, since the decode happens in an RPC worker where no test
    // hook reaches. Also an escape hatch for a host that cannot spawn nested
    // workers.
    useSliceWorkerPool: {
      type: 'boolean',
      description:
        'decode CRAM slices on a pool of workers rather than in the thread that asked',
      defaultValue: true,
      advanced: true,
    },

    /**
     * #slot cramLocation
     * location of the CRAM file
     */
    cramLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram',
        locationType: 'UriLocation',
      },
    },

    /**
     * #slot craiLocation
     * location of the CRAM index (`.crai`). Only needed when it is not named
     * `<file>.cram.crai`, which is what the `uri` shorthand assumes.
     */
    craiLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.cram.crai',
        locationType: 'UriLocation',
      },
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     * preprocessor to allow minimal config, assumes yourfile.cram.crai:
     *
     * ```json
     * {
     *   "type": "CramAdapter",
     *   "uri": "yourfile.cram"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)
export type CramAdapterConfig = Instance<typeof configSchema>
export default configSchema
