import { ConfigurationSchema } from './configuration'

export default ConfigurationSchema(
  'JBrowse1Connection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    },
    assemblyName: {
      description: 'name of the assembly the connection belongs to',
      type: 'string',
      defaultValue: 'assemblyName',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'connectionId' },
)
