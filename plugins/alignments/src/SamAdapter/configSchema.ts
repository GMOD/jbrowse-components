import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SamAdapter
 * #trackType AlignmentsTrack
 * #fileFormat alignments | SAM | Unindexed, so the whole file is loaded into memory; prefer BAM or CRAM for sequencing-scale data
 * plain-text SAM, either a file or an inline string
 *
 * There is no index, so the whole file is loaded and held in memory — this is
 * for small files (a BLAT result, a handful of assembled contigs, a test case).
 * Use BAM or CRAM for anything sequencing-scale.
 *
 * Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
 * automatically supplies it from the enclosing assembly's sequence track. It is
 * what per-base mismatches are computed against for records with no MD tag.
 *
 * #example
 * ```js
 * {
 *   type: 'SamAdapter',
 *   uri: 'https://example.com/sample.sam',
 * }
 * ```
 */

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        samLocation: {
          uri: snap.uri,
          baseUri: snap.baseUri,
        },
      }
    : snap
}

const configSchema = ConfigurationSchema(
  'SamAdapter',
  {
    /**
     * #slot
     * location of the SAM file, header lines included. Ignored when `samText`
     * supplies the alignment inline.
     */
    samLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/my.sam',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * SAM text supplied inline instead of from `samLocation`, header lines
     * included. Takes precedence when set. Lets an alignment produced in the
     * browser — a BLAT hit converted from PSL, for instance — persist in a
     * session without a file behind it.
     */
    samText: {
      type: 'text',
      defaultValue: '',
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
     *   "type": "SamAdapter",
     *   "uri": "yourfile.sam"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type SamAdapterConfig = Instance<typeof configSchema>
export default configSchema
