import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import ConfigSchema from '../configSchema'

const configSchema = ConfigurationSchema(
  'MultiLineRenderer',
  {
    filled: {
      type: 'boolean',
      defaultValue: false,
    },
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    },
  },
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
export default configSchema
