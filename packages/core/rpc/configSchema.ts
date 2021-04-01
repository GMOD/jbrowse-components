import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '../configuration'

const MainThreadRpcDriverConfigSchema = ConfigurationSchema(
  'MainThreadRpcDriver',
  {},
  { explicitlyTyped: true },
)
const WebWorkerRpcDriverConfigSchema = ConfigurationSchema(
  'WebWorkerRpcDriver',
  {},
  { explicitlyTyped: true },
)
const ElectronRpcDriverConfigSchema = ConfigurationSchema(
  'ElectronRpcDriver',
  {},
  { explicitlyTyped: true },
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
          ElectronRpcDriverConfigSchema,
        ),
      ),
      { MainThreadRpcDriver: { type: 'MainThreadRpcDriver' } },
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
