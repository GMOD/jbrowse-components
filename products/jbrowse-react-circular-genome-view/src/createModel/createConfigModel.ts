import {
  AnyConfigurationSchemaType,
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { getParent, types } from 'mobx-state-tree'

export default function createConfigModel(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
) {
  return types
    .model('Configuration', {
      configuration: ConfigurationSchema('Root', {
        rpc: RpcManager.configSchema,
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
        theme: { type: 'frozen', defaultValue: {} },
        formatDetails: ConfigurationSchema('FormatDetails', {
          feature: {
            type: 'frozen',
            description: 'adds extra fields to the feature details',
            defaultValue: {},
            contextVariable: ['feature'],
          },
          subfeatures: {
            type: 'frozen',
            description: 'adds extra fields to the subfeatures of a feature',
            defaultValue: {},
            contextVariable: ['feature'],
          },
          depth: {
            type: 'number',
            defaultValue: 2,
            description: 'depth to iterate on subfeatures',
          },
        }),
        formatAbout: ConfigurationSchema('FormatAbout', {
          config: {
            type: 'frozen',
            description: 'formats configuration object in about dialog',
            defaultValue: {},
            contextVariable: ['config'],
          },
          hideUris: {
            type: 'boolean',
            defaultValue: false,
          },
        }),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
    }))
}
