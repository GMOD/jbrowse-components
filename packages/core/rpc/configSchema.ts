import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from '../configuration'
import MainThreadRpcDriverConfigSchema from './mainThreadRpcConfig'
import WebWorkerRpcDriverConfigSchema from './webWorkerRpcConfig'

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
          {
            dispatcher: (snapshot: { type?: string }) => {
              switch (snapshot?.type) {
                case 'MainThreadRpcDriver':
                  return MainThreadRpcDriverConfigSchema
                case 'WebWorkerRpcDriver':
                  return WebWorkerRpcDriverConfigSchema
                default:
                  return undefined
              }
            },
          },
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
    actions: (self: any) => ({
      addDriverConfig(configName: string, configSnapshot: { type: string }) {
        self.drivers.set(configName, configSnapshot)
      },
    }),
  },
)
