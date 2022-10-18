import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'

const BaseRpcDriverConfigSchema = ConfigurationSchema(
  'BaseRpcDriver',
  {
    workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
    },
  },
  { explicitlyTyped: true },
)
const MainThreadRpcDriverConfigSchema = ConfigurationSchema(
  'MainThreadRpcDriver',
  {},
  { explicitlyTyped: true, baseConfiguration: BaseRpcDriverConfigSchema },
)
const WebWorkerRpcDriverConfigSchema = ConfigurationSchema(
  'WebWorkerRpcDriver',
  {},
  { explicitlyTyped: true, baseConfiguration: BaseRpcDriverConfigSchema },
)

export default ConfigurationSchema(
  'RpcOptions',
  {
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: 'MainThreadRpcDriver',
    },
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
