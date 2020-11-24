import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'ChromSizesAdapter',
  {
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/species.chrom.sizes' },
    },
  },
  { explicitlyTyped: true },
)
