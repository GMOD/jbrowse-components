import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

// #region normalizeSnapshot
export function normalizeSnapshot(snap: Record<string, unknown>) {
  return typeof snap.htsgetBase === 'string'
    ? {
        ...snap,
        htsgetBase: { uri: snap.htsgetBase, baseUri: snap.baseUri },
      }
    : snap
}
// #endregion

/**
 * #config HtsgetBamAdapter
 * #trackType AlignmentsTrack
 * #fileFormat alignments | Htsget BAM | Less exercised than plain BAM/CRAM; prefer an indexed file where possible
 * Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam library
 *
 * #example
 * ```js
 * {
 *   type: 'HtsgetBamAdapter',
 *   htsgetBase: 'https://htsget.example.com/reads',
 *   htsgetTrackId: 'NA12878',
 * }
 * ```
 */

const HtsgetBamAdapter = ConfigurationSchema(
  'HtsgetBamAdapter',
  {
    // A location rather than the string this used to be, because that is what
    // carries an internet account's pre-authorization into the RPC worker:
    // `serializeArguments` finds what to authorize by walking the args for a
    // `uri`, and a string slot is invisible to that walk. An endpoint behind
    // OAuth or HTTP Basic read as unauthenticated in every worker-driver
    // product — jbrowse-web's default — until this became one.
    /**
     * #slot
     * The endpoint tickets are requested from. `htsgetTrackId` is appended to
     * it, so a trailing slash produces a doubled one in the request path.
     */
    htsgetBase: {
      type: 'fileLocation',
      description: 'the base URL to fetch from',
      defaultValue: { uri: '', locationType: 'UriLocation' },
    },
    /**
     * #slot
     */
    htsgetTrackId: {
      type: 'string',
      description: 'the trackId, which is appended to the base URL',
      defaultValue: '',
    },
  },
  {
    explicitlyTyped: true,

    /**
     * #preProcessSnapshot
     *
     *
     * preprocessor to allow the pre-v5 string spelling of `htsgetBase`:
     * ```json
     * {
     *   "type": "HtsgetBamAdapter",
     *   "htsgetBase": "https://htsget.example.com/reads",
     *   "htsgetTrackId": "NA12878"
     * }
     * ```
     */
    preProcessSnapshot: normalizeSnapshot,
  },
)

export type HtsgetBamAdapterConfig = Instance<typeof HtsgetBamAdapter>
export default HtsgetBamAdapter
