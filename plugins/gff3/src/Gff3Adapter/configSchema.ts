import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config Gff3Adapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const Gff3Adapter = ConfigurationSchema(
  'Gff3Adapter',
  {
    /**
     * #slot
     */
    gffLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/my.gff' },
      type: 'fileLocation',
    },
  },
  { explicitlyTyped: true },
)

export default Gff3Adapter
