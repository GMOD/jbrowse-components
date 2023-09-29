import PluginManager from '@jbrowse/core/PluginManager'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'

// locals
import configSchema from '../configSchema'
import { fetchAll } from '../fetching-utils'
import { generateTracks, getAssemblies } from './configure-utils'

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
        const session = getSession(self)
        try {
          // NOTE: name comes from the base configuration
          const connectionName = getConf(self, 'name')
          const hubFileLocation = getConf(self, 'hubTxtLocation')

          const hubData = await fetchAll(hubFileLocation)

          // create or alias any assemblies
          const assemblies = getAssemblies(hubData, session)
          console.log('test', assemblies)
          const tracks = generateTracks(())

          // TODO: create tracks
        } catch (e) {
          console.error(e)
          session.notify(
            `There was a problem connecting to the UCSC Hub "${self.configuration.name}". Please make sure you have entered a valid hub.txt file. The error that was thrown is: "${e}"`,
            'error',
          )
          session.breakConnection(self.configuration)
        }
      },
    }))
}

export type UCSCConnectionModel = Instance<
  ReturnType<typeof UCSCTrackHubConnection>
>
