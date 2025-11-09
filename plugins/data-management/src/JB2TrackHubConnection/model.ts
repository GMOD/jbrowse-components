import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from 'mobx-state-tree'

import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel JB2TrackHubConnection
 * extends BaseConnectionModel
 */
export default function JB2TrackHubConnection(pluginManager: PluginManager) {
  return types
    .compose(
      'JB2TrackHubConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        type: types.literal('JB2TrackHubConnection'),
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      async connect() {
        const { doConnect } = await import('./doConnect')

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        doConnect(self)
      },
    }))
}
