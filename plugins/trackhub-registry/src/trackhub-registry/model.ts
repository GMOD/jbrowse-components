import {
  AnyConfigurationModel,
  ConfigurationReference,
  readConfObject,
  getConf,
} from '@jbrowse/core/configuration'
import { BaseConnectionModelFactory } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import { types, Instance } from 'mobx-state-tree'

// locals
import configSchema from './configSchema'
import { generateTracks } from './tracks'
import { mfetch } from './util'

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'TheTrackHubRegistryConnection',
      BaseConnectionModelFactory(pluginManager),
      types.model({
        type: types.literal('TheTrackHubRegistryConnection'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      error: undefined as unknown,
    }))
    .actions(self => ({
      async connect(connectionConf: AnyConfigurationModel) {
        // @ts-ignore
        self.clear()
        const trackDbId = readConfObject(connectionConf, 'trackDbId')
        try {
          const trackDb = await mfetch(
            `https://www.trackhubregistry.org/api/search/trackdb/${trackDbId}`,
          )
          // eslint-disable-next-line no-underscore-dangle
          const assemblyName = trackDb._source.assembly.name
          const session = getSession(self)
          const assembly = session.assemblyManager.get(assemblyName)
          if (!assembly) {
            throw new Error(`unknown assembly ${assemblyName}`)
          }
          const sequenceAdapter = getConf(assembly, ['sequence', 'adapter'])
          self.setTrackConfs(
            generateTracks(trackDb, assemblyName, sequenceAdapter),
          )
        } catch (e) {
          console.error(e)
          this.setError(e)
        }
      },
      setError(e: unknown) {
        self.error = e
      },
    }))
}

export type TrackHubConnectionStateModel = ReturnType<typeof stateModelFactory>
export type TrackHubConnectionModel = Instance<TrackHubConnectionStateModel>
