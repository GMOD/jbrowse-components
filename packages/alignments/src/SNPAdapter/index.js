import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { types } from 'mobx-state-tree'

export { default as AdapterClass } from './SNPAdapter'

export const configSchema = ConfigurationSchema(
  'SNPAdapter',
  {
    // verify extension names
    subadapter: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)
