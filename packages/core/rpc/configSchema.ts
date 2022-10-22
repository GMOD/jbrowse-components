import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'
import WebWorkerRpcDriverConfigSchema from './webWorkerRpcConfig'
import MainThreadRpcDriverConfigSchema from './mainThreadRpcConfig'

/**
 * #config RpcOptions
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default ConfigurationSchema(
  'RpcOptions',
  {
    /**
     * #slot
     */
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: 'MainThreadRpcDriver',
    },
    /**
     * #slot
     */
    drivers: types.optional(
      types.map(
        types.union(
          MainThreadRpcDriverConfigSchema,
          WebWorkerRpcDriverConfigSchema,
        ),
      ),
      {
        MainThreadRpcDriver: { type: 'MainThreadRpcDriver' },
        WebWorkerRpcDriver: { type: 'WebWorkerRpcDriver' },
      },
    ),
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: (self: any) => ({
      addDriverConfig(configName: string, configSnapshot: { type: string }) {
        self.drivers.set(configName, configSnapshot)
      },
    }),
  },
)
