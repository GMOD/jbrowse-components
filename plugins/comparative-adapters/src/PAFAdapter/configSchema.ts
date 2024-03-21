import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config PAFAdapter
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const PAFAdapter = ConfigurationSchema(
  'PAFAdapter',
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
    pafLocation: {
      defaultValue: {
        locationType: 'UriLocation',
        uri: '/path/to/file.paf',
      },
      type: 'fileLocation',
    },

    /**
     * #slot
     */
    queryAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the query assembly name',
      type: 'string',
    },

    /**
     * #slot
     */
    targetAssembly: {
      defaultValue: '',
      description: 'Alternative to assemblyNames: the target assembly name',
      type: 'string',
    },
  },
  { explicitlyTyped: true },
)

export default PAFAdapter
