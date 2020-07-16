import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { getParent, IAnyType, SnapshotOrInstance, types } from 'mobx-state-tree'

export default function JBrowseWeb(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: IAnyType,
) {
  const trackType = pluginManager.pluggableConfigSchemaType('track')
  return types
    .model('JBrowseWeb', {
      configuration: ConfigurationSchema('Root', {
        rpc: RpcManager.configSchema,
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
      }),
      assembly: assemblyConfigSchemasType,
      // track configuration is an array of track config schemas. multiple
      // instances of a track can exist that use the same configuration
      tracks: types.array(trackType),
    })
    .views(self => ({
      get assemblyName(): string {
        return readConfObject(self.assembly, 'name')
      },
      get rpcManager() {
        return getParent(self).rpcManager
      },
    }))
    .actions(self => ({
      addTrackConf(trackConf: SnapshotOrInstance<typeof trackType>) {
        const { type } = trackConf
        if (!type) throw new Error(`unknown track type ${type}`)
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
    }))
}
