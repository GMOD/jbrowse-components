import type { Instance } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../configuration'

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
    assemblyNames: {
      defaultValue: [],
      description: 'optional list of names of assemblies in this connection',
      type: 'stringArray',
    },

    /**
     * #slot
     */
    name: {
      defaultValue: 'nameOfConnection',
      description: 'a unique name for this connection',
      type: 'string',
    },
  },
  {
    /**
     * #identifier
     */
    explicitIdentifier: 'connectionId',

    explicitlyTyped: true,
  },
)

export default BaseConnectionConfig
export type BaseConnectionConfigSchema = typeof BaseConnectionConfig
export type BaseConnectionConfigModel = Instance<BaseConnectionConfigSchema>
