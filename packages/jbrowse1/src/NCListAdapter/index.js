import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './NCListAdapter'

export const configSchema = ConfigurationSchema(
  'NCListAdapter',
  {
    rootUrlTemplate: {
      type: 'string',
      defaultValue: '/path/to/my/{refseq}/trackData.json',
    },
  },
  { explicitlyTyped: true },
)
