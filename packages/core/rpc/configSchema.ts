import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'

/**
 * !config BaseRpcDriver
 */
const BaseRpcDriverConfigSchema = ConfigurationSchema(
  'BaseRpcDriver',
  {
    /**
     * !slot
     */
    workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    },
  },
  { explicitlyTyped: true },
)

/**
 * !config MainThreadRpcDriver
 */
const MainThreadRpcDriverConfigSchema = ConfigurationSchema(
  'MainThreadRpcDriver',
  {},
  {
    /**
     * !baseConfiguration
     */
    baseConfiguration: BaseRpcDriverConfigSchema,
    explicitlyTyped: true,
  },
)

/**
 * !config WebWorkerRpcDriver
 */
const WebWorkerRpcDriverConfigSchema = ConfigurationSchema(
  'WebWorkerRpcDriver',
  {},
  {
    /**
     * !baseConfiguration
     */
    baseConfiguration: BaseRpcDriverConfigSchema,
    explicitlyTyped: true,
  },
)

/**
 * !config RpcOptions
 */
export default ConfigurationSchema(
  'RpcOptions',
  {
    /**
     * !slot
     */
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: 'MainThreadRpcDriver',
    },
    /**
     * !slot
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
