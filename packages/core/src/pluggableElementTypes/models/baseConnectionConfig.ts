import { ConfigurationSchema } from '../../configuration/index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseConnection
 * #gotcha A connection config is only a pointer: the hub's track list is
 * fetched when the connection loads and held in memory, and is **not** written
 * into a saved or shared session. Only a track you actually open is stored
 * (under `connectionTrackConfigs`, keyed by `trackId`), which is what keeps a
 * shared session small even against a very large hub.
 */

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
