import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { getParent, types } from '@jbrowse/mobx-state-tree'

import { FormatAboutConfigSchemaFactory } from './FormatAbout.ts'
import { FormatDetailsConfigSchemaFactory } from './FormatDetails.ts'
import { HierarchicalConfigSchemaFactory } from './HierarchicalConfig.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

export function createConfigModel(
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
        hierarchical: HierarchicalConfigSchemaFactory(),
        formatDetails: FormatDetailsConfigSchemaFactory(),
        formatAbout: FormatAboutConfigSchemaFactory(),
        theme: { type: 'frozen', defaultValue: {} },
      }),
      assembly: assemblyConfigSchemasType,
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
      internetAccounts: types.array(
        pluginManager.pluggableConfigSchemaType('internet account'),
      ),
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      aggregateTextSearchAdapters: types.array(
        pluginManager.pluggableConfigSchemaType('text search adapter'),
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
        return getParent<any>(self).rpcManager
      },
    }))
}
