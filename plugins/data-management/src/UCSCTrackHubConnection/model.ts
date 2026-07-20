import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'

import { lazyConnect } from '../lazyConnect.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel UCSCTrackHubConnection
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
      connect() {
        return lazyConnect(self, () => import('./doConnect.ts'))
      },
    }))
}
