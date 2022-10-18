import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * !config
 */
const Gff3Adapter = ConfigurationSchema(
  'Gff3Adapter',
  {
    /**
     * !slot
     */
    gffLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/my.gff', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)

export default Gff3Adapter
