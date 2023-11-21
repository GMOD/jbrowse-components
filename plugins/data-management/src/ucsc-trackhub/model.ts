import PluginManager from '@jbrowse/core/PluginManager'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

// locals
import configSchema from './configSchema'

export default function UCSCTrackHubConnection(pluginManager: PluginManager) {
  return types
    .compose(
      'UCSCTrackHubConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        configuration: ConfigurationReference(configSchema),
        type: types.literal('UCSCTrackHubConnection'),
      }),
    )
    .actions(self => ({
      async connect() {
        const { doConnect } = await import('./doConnect')

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        doConnect(self)
      },
    }))
}
