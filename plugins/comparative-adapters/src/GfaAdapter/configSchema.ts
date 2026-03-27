import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config GfaAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const GfaAdapter = ConfigurationSchema(
  'GfaAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names (genome sample names from GFA paths)',
    },
    /**
     * #slot
     */
    gfaLocation: {
      type: 'fileLocation',
      description: 'Location of the GFA file',
      defaultValue: {
        uri: '/path/to/graph.gfa',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default GfaAdapter
