import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { getParent, IAnyType, types } from 'mobx-state-tree'

export default function createConfigModel(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: IAnyType,
) {
  return types
    .model('Configuration', {
      configuration: ConfigurationSchema('Root', {
        rpc: RpcManager.configSchema,
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
      }),
      assembly: assemblyConfigSchemasType,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      plugins: types.frozen(),
    })
    .views(self => ({
      get assemblies() {
        return [self.assembly]
      },
      get assemblyName(): string {
        return readConfObject(self.assembly, 'name')
      },
      get rpcManager() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
    }))
}
