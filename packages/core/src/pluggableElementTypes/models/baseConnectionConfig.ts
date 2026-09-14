import { ConfigurationSchema } from '../../configuration/index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseConnection
 * #gotcha JBrowse fetches the hub's track list when the connection loads and
 * holds it in memory, and does **not** write it into a saved or shared session.
 * The session stores only the tracks you open (under `connectionTrackConfigs`,
 * keyed by `trackId`), so a shared session stays small even for a very large
 * hub.
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
