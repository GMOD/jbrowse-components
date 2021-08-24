import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'TwoBitAdapter',
  {
    twoBitLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.2bit', locationType: 'UriLocation' },
    },
    chromSizesLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/default.chrom.sizes',
        locationType: 'UriLocation',
      },
      description:
        'An optional chrom.sizes file can be supplied to speed up loading since parsing the twobit file can take time',
    },
  },
  { explicitlyTyped: true },
)
