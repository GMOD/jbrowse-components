import { ConfigurationSchema } from '../configuration'

export default ConfigurationSchema('RpcOptions', {
  defaultDriver: {
    type: 'string',
    description:
      'the RPC backend to use for tracks and tasks that are not configured to use a specific RPC backend',
    defaultValue: 'WebWorkerRpcDriver',
  },
})
