import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
} from '@jbrowse/product-core'
import { getParent, IAnyType, types } from 'mobx-state-tree'

/**
 * #config JBrowseReactLinearGenomeViewConfig
 * #category root
 */
export default function createConfigModel(
  pluginManager: PluginManager,
  assemblyConfigSchemasType: IAnyType,
) {
  return types
    .model('Configuration', {
      /**
       * #slot
       */
      aggregateTextSearchAdapters: types.array(
        pluginManager.pluggableConfigSchemaType('text search adapter'),
      ),

      /**
       * #slot
       */
      assembly: assemblyConfigSchemasType,

      configuration: ConfigurationSchema('Root', {
        formatAbout: FormatAboutConfigSchemaFactory(),

        formatDetails: FormatDetailsConfigSchemaFactory(),

        hierarchical: HierarchicalConfigSchemaFactory(),

        /**
         * #slot configuration.highResolutionScaling
         */
        highResolutionScaling: {
          defaultValue: 2,
          type: 'number',
        },
        /**
         * #slot configuration.rpc
         */
        rpc: RpcManager.configSchema,
        /**
         * #slot configuration.theme
         */
        theme: { defaultValue: {}, type: 'frozen' },
      }),

      /**
       * #slot
       */
      connections: types.array(
        pluginManager.pluggableConfigSchemaType('connection'),
      ),

      /**
       * #slot
       */
      internetAccounts: types.array(
        pluginManager.pluggableConfigSchemaType('internet account'),
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

      /**
       * #slot
       */
      tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
    }))
}
