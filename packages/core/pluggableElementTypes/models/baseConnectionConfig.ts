import { ConfigurationSchema } from '../../configuration'

/**
 * #config
 */
export default ConfigurationSchema(
  'BaseConnection',
  {
    /**
     * #slot
     */
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'connectionId' },
)
