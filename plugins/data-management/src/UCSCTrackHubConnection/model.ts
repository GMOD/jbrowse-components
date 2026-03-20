import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel UCSCTrackHubConnection
 * extends BaseConnectionModel
 */
export default function UCSCTrackHubConnection(pluginManager: PluginManager) {
  return types
    .compose(
      'UCSCTrackHubConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        type: types.literal('UCSCTrackHubConnection'),
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      async connect() {
        const { doConnect } = await import('./doConnect.ts')

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        doConnect(self)
      },
    }))
}
