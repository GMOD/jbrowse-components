import {
  AnyConfigurationSchemaType,
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { getParent, types } from 'mobx-state-tree'

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
        formatDetails: ConfigurationSchema('FormatDetails', {
          /**
           * #slot configuration.formatDetails.feature
           */
          feature: {
            type: 'frozen',
            description: 'adds extra fields to the feature details',
            defaultValue: {},
            contextVariable: ['feature'],
          },
          /**
           * #slot configuration.formatDetails.subfeatures
           */
          subfeatures: {
            type: 'frozen',
            description: 'adds extra fields to the subfeatures of a feature',
            defaultValue: {},
            contextVariable: ['feature'],
          },
          /**
           * #slot configuration.formatDetails.depth
           */
          depth: {
            type: 'number',
            defaultValue: 2,
            description: 'depth to iterate on subfeatures',
          },
        }),
        formatAbout: ConfigurationSchema('FormatAbout', {
          /**
           * #slot configuration.formatAbout.config
           */
          config: {
            type: 'frozen',
            description: 'formats configuration object in about dialog',
            defaultValue: {},
            contextVariable: ['config'],
          },
          /**
           * #slot configuration.formatAbout.hideUris
           */

          hideUris: {
            type: 'boolean',
            defaultValue: false,
          },
        }),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return getParent<any>(self).rpcManager
      },
    }))
}
