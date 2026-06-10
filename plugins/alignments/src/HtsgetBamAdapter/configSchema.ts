import { ConfigurationSchema } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
/**
 * #config HtsgetBamAdapter
 * Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam library
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
