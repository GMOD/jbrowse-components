import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export default types.late(() =>
  ConfigurationSchema(
    'HtsgetBamAdapter',
    {
      htsgetBase: {
        type: 'string',
        defaultValue: '',
      },
      htsgetTrackId: {
        type: 'string',
        defaultValue: '',
      },
      sequenceAdapter: {
        type: 'frozen',
        defaultValue: null,
      },
    },
    { explicitlyTyped: true },
  ),
)
