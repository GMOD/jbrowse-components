import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { CONTACT_CHANNELS } from './contactChannels.ts'

/**
 * #config AlignmentsContactAdapter
 * #category adapter
 * #trackType HicTrack
 * #fileFormat hic | BAM/CRAM read pairs | Contacts computed from the reads in view, so it needs no `.hic` file and shows nothing zoomed out
 * builds a contact matrix live from a BAM/CRAM instead of a `.hic` file, so an
 * SV signature (Cue's contact map) can be looked at without running juicer.
 * Contacts are computed from the reads in the current view, like the pileup,
 * so this is a zoomed-in track rather than a whole-genome one
 *
 * #example
 * ```js
 * {
 *   type: 'AlignmentsContactAdapter',
 *   channel: 'sameStrand',
 *   subadapter: {
 *     type: 'BamAdapter',
 *     uri: 'https://example.com/sample.bam',
 *   },
 * }
 * ```
 */
const AlignmentsContactAdapter = ConfigurationSchema(
  'AlignmentsContactAdapter',
  {
    /**
     * #slot
     * the alignments adapter the contacts are computed from — a `BamAdapter` or
     * `CramAdapter` config, written the same way it would be on an
     * `AlignmentsTrack`
     */
    subadapter: {
      type: 'frozen',
      defaultValue: null,
      description: 'BamAdapter/CramAdapter config to read alignments from',
    },
    /**
     * #slot
     * which signature the matrix carries. `discordant` is every pair whose
     * mates are at least `minSpan` apart plus every split-read segment;
     * `sameStrand` is the LL/RR inversion signature; `outward` is the RL
     * eversion signature; `depthDifference` is |depth[a] − depth[b]| over bin
     * pairs, which is the plaid Cue's read-depth channel draws
     */
    channel: {
      type: 'stringEnum',
      model: types.enumeration('channel', [...CONTACT_CHANNELS]),
      defaultValue: 'discordant',
      description: 'read-pair signature the contact matrix carries',
    },
    /**
     * #slot
     * how far apart in bp a pair's mates must be for `discordant` to count it.
     * The default clears an ordinary library's insert size — the 2x148 300x
     * genome this was measured on has a p99 insert of 849 bp — so what is left
     * is the pairs an SV put there
     */
    minSpan: {
      type: 'number',
      defaultValue: 1000,
      description: 'minimum bp between mates for a discordant contact',
    },
    /**
     * #slot
     * bin sizes the display offers as resolutions, finest first. It picks one
     * from the current zoom the same way it picks a `.hic` file's, and
     * `resolutionBias` steps it
     */
    binSizes: {
      type: 'frozen',
      defaultValue: [750, 1500, 5000, 25000],
      description: 'bin sizes in bp, offered to the display as resolutions',
    },
  },
  { explicitlyTyped: true },
)

export default AlignmentsContactAdapter
