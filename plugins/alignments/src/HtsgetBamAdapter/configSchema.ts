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
      defaultValue: '',
      description: 'the base URL to fetch from',
      type: 'string',
    },
    /**
     * #slot
     */
    htsgetTrackId: {
      defaultValue: '',
      description: 'the trackId, which is appended to the base URL',
      type: 'string',
    },
    /**
     * #slot
     */
    sequenceAdapter: {
      defaultValue: null,
      description:
        'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
      type: 'frozen',
    },
  },
  { explicitlyTyped: true },
)

export default HtsgetBamAdapter
