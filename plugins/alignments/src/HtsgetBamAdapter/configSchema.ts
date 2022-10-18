import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
/**
 * !config
 * Used to fetch data from Htsget endpoints in BAM format
 * Uses @gmod/bam
 */
const HtsgetBamAdapter = types.late(() =>
  ConfigurationSchema(
    'HtsgetBamAdapter',
    {
      /**
       * !slot
       */
      htsgetBase: {
        type: 'string',
        description: 'the base URL to fetch from',
        defaultValue: '',
      },
      /**
       * !slot
       */
      htsgetTrackId: {
        type: 'string',
        description: 'the trackId, which is appended to the base URL',
        defaultValue: '',
      },
      /**
       * !slot
       */
      sequenceAdapter: {
        type: 'frozen',
        description:
          'sequence data adapter, used to calculate SNPs when BAM reads lacking MD tags',
        defaultValue: null,
      },
    },
    { explicitlyTyped: true },
  ),
)
export default HtsgetBamAdapter
