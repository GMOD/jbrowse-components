import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config DeltaAdapter
 * #category adapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const DeltaAdapter = ConfigurationSchema(
  'DeltaAdapter',
  {
    /**
     * #slot
     */
    assemblyNames: {
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    deltaLocation: {
      defaultValue: { locationType: 'UriLocation', uri: '/path/to/file.delta' },
      type: 'fileLocation',
    },

    /**
     * #slot
     * alternative to assembly names
     */
    queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
      type: 'string',
    },

    /**
     * #slot
     * alternative to assembly names
     */
    targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default DeltaAdapter
