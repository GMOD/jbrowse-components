import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
} from '@jbrowse/product-core'
import { getParent, types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #config JBrowseReactCircularGenomeViewConfig
 * #category root
 */
export default function createConfigModel(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: AnyConfigurationSchemaType,
) {
  return types
    .model('Configuration', {
      configuration: ConfigurationSchema('Root', {
        /**
         * #slot configuration.rpc
         */
        rpc: RpcManager.configSchema,
        /**
         * #slot configuration.highResolutionScaling
         */
        highResolutionScaling: {
          type: 'number',
          defaultValue: 2,
        },
        formatDetails: FormatDetailsConfigSchemaFactory(),
        formatAbout: FormatAboutConfigSchemaFactory(),
        hierarchical: HierarchicalConfigSchemaFactory(),
        /**
         * #slot configuration.theme
         */
        theme: { type: 'frozen', defaultValue: {} },
      }),
      /**
       * #slot
       */
      assembly: assemblyConfigSchemasType,
      /**
       * #slot
       */
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
      /**
       * #slot
       */
      internetAccounts: types.array(
        pluginManager.pluggableConfigSchemaType('internet account'),
      ),
      /**
       * #slot
       */
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),
      /**
       * #slot
       */
      aggregateTextSearchAdapters: types.array(
        pluginManager.pluggableConfigSchemaType('text search adapter'),
      ),
      /**
       * #slot
       * defines plugins of the format
       * ```typescript
       * type PluginDefinition=
       *    { umdUrl: string, name:string } |
       *    { url: string, name: string } |
       *    { esmUrl: string } |
       *    { cjsUrl: string } |
       *    { umdLoc: { uri: string } } |
       *    { esmLoc: { uri: string } } |
       * ```
       */
      plugins: types.frozen(),
    })
    .views(self => ({
      /**
       * #getter
       */
      get assemblies() {
        return [self.assembly]
      },
      /**
       * #getter
       */
      get assemblyName(): string {
        return readConfObject(self.assembly, 'name')
      },
      /**
       * #getter
       */
      get rpcManager() {
        return getParent<any>(self).rpcManager
      },
    }))
}
