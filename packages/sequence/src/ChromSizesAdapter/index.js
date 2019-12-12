import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

export { default as AdapterClass } from './ChromSizesAdapter'

export const configSchema = ConfigurationSchema(
  'ChromSizesAdapter',
  {
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/species.chrom.sizes' },
    },
  },
  { explicitlyTyped: true },
)
