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
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The query assembly name is the first value in the array, target assembly name is the second',
    },
    /**
     * #slot
     * alternative to assembly names
     */
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    },
    /**
     * #slot
     * alternative to assembly names
     */
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    },
    /**
     * #slot
     */
    deltaLocation: {
      type: 'fileLocation',
      defaultValue: {
        uri: '/path/to/file.delta',
        locationType: 'UriLocation',
      },
    },
  },
  { explicitlyTyped: true },
)

export default DeltaAdapter
