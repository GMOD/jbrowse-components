import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config CramAdapter
 * #trackType AlignmentsTrack
 * #fileFormat alignments | CRAM
 * used to configure CRAM adapter
 *
 * Note: `sequenceAdapter` does **not** need to be specified manually — JBrowse
 * automatically supplies it from the enclosing assembly's sequence track.
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

const configSchema = ConfigurationSchema(
  'CramAdapter',
  {
    /**
     * #slot fetchSizeLimit
     */
    fetchSizeLimit: {
      type: 'number',
      description:
        'size in bytes over which to display a warning to the user that too much data will be fetched',
      defaultValue: 3_000_000,
      advanced: true,
    },

    /**
     * #slot cramLocation
     * location of the CRAM file. CRAM stores each read as differences from the
     * reference it was compressed against, so the assembly's sequence has to be
     * that same reference — pointing this at an assembly built from a different
     * FASTA shows up as widespread false mismatches rather than as an error.
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
     * location of the CRAM index (`.crai`) written by `samtools index`. Only
     * needed when the index is not named `<file>.cram.crai`, which is what the
     * `uri` shorthand assumes.
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
