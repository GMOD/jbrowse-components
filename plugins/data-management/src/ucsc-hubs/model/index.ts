import PluginManager from '@jbrowse/core/PluginManager'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'

// locals
import configSchema from '../configSchema'
import { fetchAll } from '../fetching-utils'
import { configureAssemblies } from './configure-utils'

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
          const connectionName = getConf(self, 'name') // NOTE: name comes from the base configuration
          const hubFileLocation = getConf(self, 'hubTxtLocation')

          const abortHubDownload = new AbortController()
          const hubData = await fetchAll(
            hubFileLocation,
            abortHubDownload.signal,
          )

          // create or alias any assemblies
          const assemblies = await configureAssemblies(
            hubData,
            self as UCSCConnectionModel,
          )

          // create tracks
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
