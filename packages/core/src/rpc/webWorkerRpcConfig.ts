import BaseRpcDriverConfigSchema from './baseRpcConfig.ts'
import { ConfigurationSchema } from '../configuration/index.ts'

/**
 * #config WebWorkerRpcDriver
 */

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
