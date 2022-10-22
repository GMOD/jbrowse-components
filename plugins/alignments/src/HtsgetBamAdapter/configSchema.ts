import { ConfigurationSchema } from '@jbrowse/core/configuration'
/**
 * #config HtsgetBamAdapter
 * Used to fetch data from Htsget endpoints in BAM format, using the gmod/bam library
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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
    /**
     * #slot
     */
    sequenceAdapter: {
      type: 'frozen',
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      defaultValue: null,
    },
  },
  { explicitlyTyped: true },
)

export default HtsgetBamAdapter
