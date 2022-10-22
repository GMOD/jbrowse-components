import { ConfigurationSchema } from '../configuration'
import BaseRpcDriverConfigSchema from './baseRpcConfig'

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
