import { types } from '@jbrowse/mobx-state-tree'

import MainThreadRpcDriverConfigSchema from './mainThreadRpcConfig.ts'
import WebWorkerRpcDriverConfigSchema from './webWorkerRpcConfig.ts'
import { ConfigurationSchema } from '../configuration/index.ts'

/**
 * #config RpcOptions
 */
export default ConfigurationSchema('RpcOptions', {
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
      MainThreadRpcDriver: {
        type: 'MainThreadRpcDriver',
      },
      WebWorkerRpcDriver: {
        type: 'WebWorkerRpcDriver',
      },
    },
  ),
})
