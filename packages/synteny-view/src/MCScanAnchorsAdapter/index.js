import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './MCScanAnchorsAdapter'

export const configSchema = ConfigurationSchema(
  'MCScanAnchorsAdapter',
  {
    mcscanAnchorsLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/species1.species2.anchors' },
    },
  },
  { explicitlyTyped: true },
)
