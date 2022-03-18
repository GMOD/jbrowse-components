import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default ConfigurationSchema(
  'DeltaAdapter',
  {
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'Array of assembly names to use for this file. The target assembly name is the first value in the array, query assembly name is the second',
    },
    targetAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
    },
    queryAssembly: {
      type: 'string',
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
    },
    deltaLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/file.delta', locationType: 'UriLocation' },
    },
  },
  { explicitlyTyped: true },
)
