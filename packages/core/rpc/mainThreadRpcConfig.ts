import { ConfigurationSchema } from '../configuration'
import BaseRpcDriverConfigSchema from './baseRpcConfig'

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
