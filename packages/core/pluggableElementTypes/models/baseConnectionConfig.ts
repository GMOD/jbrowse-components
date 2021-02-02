import { ConfigurationSchema } from '../../configuration'

export default ConfigurationSchema(
  'BaseConnection',
  {
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    },
  },
  { explicitlyTyped: true, explicitIdentifier: 'connectionId' },
)
