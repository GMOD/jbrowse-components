import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './SNPCoverageAdapter'

export const configSchema = ConfigurationSchema(
  'SNPCoverageAdapter',
  {
    subadapter: {
      type: 'frozen',
      defaultValue: {},
    },
  },
  { explicitlyTyped: true },
)
