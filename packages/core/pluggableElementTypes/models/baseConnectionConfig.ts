import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema(
  'BaseConnection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    },
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'connectionId' },
)
