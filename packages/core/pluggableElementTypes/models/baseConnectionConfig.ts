import { ConfigurationSchema } from '../../configuration'
import type { Instance } from 'mobx-state-tree'

/**
 * #config BaseConnection
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const BaseConnectionConfig = ConfigurationSchema(
  'BaseConnection',
  {
    /**
     * #slot
     */
    name: {
      type: 'string',
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
    },
    /**
     * #slot
     */
    assemblyNames: {
      type: 'stringArray',
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
    },
  },
  {
    explicitlyTyped: true,
    /**
     * #identifier
     */
    explicitIdentifier: 'connectionId',
  },
)

export default BaseConnectionConfig
export type BaseConnectionConfigSchema = typeof BaseConnectionConfig
export type BaseConnectionConfigModel = Instance<BaseConnectionConfigSchema>
