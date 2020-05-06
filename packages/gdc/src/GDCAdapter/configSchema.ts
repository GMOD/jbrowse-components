import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export default ConfigurationSchema(
  'GDCAdapter',
  {
    filters: {
      type: 'string',
      defaultValue: '{}',
      description:
        'The filters to be applied to the track. Only edit if you know what you are doing.',
    },
    featureType: {
      type: 'stringEnum',
      model: types.enumeration('Feature Type', ['mutation', 'gene']),
      defaultValue: 'mutation',
      description: 'The type of track to add',
    },
    cases: {
      type: 'stringArray',
      defaultValue: [],
      description: 'GDC case UUIDs',
    },
    size: {
      type: 'integer',
      defaultValue: 5000,
      description: 'The max number of features to show.',
    },
  },
  { explicitlyTyped: true },
)
