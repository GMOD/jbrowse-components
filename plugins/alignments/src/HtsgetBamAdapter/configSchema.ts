import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { Instance } from '@jbrowse/mobx-state-tree'

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
 *   htsgetBase: 'https://htsget.example.com/reads/',
 *   htsgetTrackId: 'NA12878',
 * }
 * ```
 */

const HtsgetBamAdapter = ConfigurationSchema(
  'HtsgetBamAdapter',
  {
    /**
     * #slot
     */
    htsgetBase: {
      type: 'string',
      description: 'the base URL to fetch from',
      defaultValue: '',
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
  { explicitlyTyped: true },
)

export type HtsgetBamAdapterConfig = Instance<typeof HtsgetBamAdapter>
export default HtsgetBamAdapter
