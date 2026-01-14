import BaseRpcDriverConfigSchema from './baseRpcConfig.ts'
import { ConfigurationSchema } from '../configuration/index.ts'

/**
 * #config MainThreadRpcDriver
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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
