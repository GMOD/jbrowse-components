import BaseRpcDriverConfigSchema from './baseRpcConfig.ts'
import { ConfigurationSchema } from '../configuration/index.ts'

/**
 * #config WebWorkerRpcDriver
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const WebWorkerRpcDriverConfigSchema = ConfigurationSchema(
  'WebWorkerRpcDriver',
  {},
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: BaseRpcDriverConfigSchema,
    explicitlyTyped: true,
  },
)
export default WebWorkerRpcDriverConfigSchema
