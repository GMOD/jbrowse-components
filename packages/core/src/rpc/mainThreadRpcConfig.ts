import BaseRpcDriverConfigSchema from './baseRpcConfig.ts'
import { ConfigurationSchema } from '../configuration/index.ts'

/**
 * #config MainThreadRpcDriver
 */

const MainThreadRpcDriverConfigSchema = ConfigurationSchema(
  'MainThreadRpcDriver',
  {},
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: BaseRpcDriverConfigSchema,
    explicitlyTyped: true,
  },
)
export default MainThreadRpcDriverConfigSchema
