import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export { default as AdapterClass } from './GDCAdapter'

export const configSchema = ConfigurationSchema(
  'GDCAdapter',
  {
    filters: {
      type: 'string',
      defaultValue: '{}',
      description: 'The filters to be applied to the track',
    },
    featureType: {
      type: 'stringEnum',
      model: types.enumeration('Feature Type', ['ssm', 'gene']),
      defaultValue: 'ssm',
      description: 'The type of track to add',
    },
    case: {
      type: 'string',
      defaultValue: '',
      description: 'The GDC case UUID',
    },
    size: {
      type: 'integer',
      defaultValue: 100,
      description: 'The max number of features to show per panel',
    },
  },
  { explicitlyTyped: true },
)
