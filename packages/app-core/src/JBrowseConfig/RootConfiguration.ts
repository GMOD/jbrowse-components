import { ConfigurationSchema } from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { appRootConfigSchemaFields } from '@jbrowse/core/util/types'
import {
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
  PreferencesConfigSchemaFactory,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

/**
 * #config JBrowseConfiguration
 * #category root
 * Holds the app-wide settings in the `configuration` key of a config file,
 * beside `assemblies` and `tracks`.
 *
 * ```json
 * {
 *   assemblies,
 *   tracks,
 *   configuration: { these entries here  }
 * }
 * ```
 */
export default function RootConfiguration({
  pluginManager,
  extraConfigSlots = {},
}: {
  pluginManager: PluginManager
  // product-specific config slots, e.g. desktop's sourceConfigUrl; kept out of
  // the shared schema so they don't appear on web/embedded
  extraConfigSlots?: ConfigurationSchemaDefinition
}) {
  return ConfigurationSchema('Root', {
    ...extraConfigSlots,
    /**
     * #slot configuration.rpc
     * configuration for the RPC system that runs data adapters in web workers,
     * see RpcOptions
     */
    rpc: RpcManager.configSchema,

    /**
     * #slot configuration.formatDetails
     * jexl callbacks that add, rewrite or hide fields in the feature-details
     * panel of every track at once. A track can set the same ones in the track's
     * `formatDetails` and override individual keys.
     */
    formatDetails: FormatDetailsConfigSchemaFactory(),

    /**
     * #slot configuration.formatAbout
     * jexl callbacks that add, rewrite or hide fields in the About dialog of
     * every track at once. A track can set the same ones in the track's
     * `formatAbout` and override individual keys.
     */
    formatAbout: FormatAboutConfigSchemaFactory(),

    /**
     * #slot configuration.shareURL
     *
     * #slot configuration.disableAnalytics
     *
     * #slot configuration.logoPath
     */
    ...appRootConfigSchemaFields,
    /**
     * #slot configuration.hierarchical
     * configuration for the hierarchical track selector, controlling sorting
     * and default categories, see HierarchicalConfigSchema
     */
    hierarchical: HierarchicalConfigSchemaFactory(),
    /**
     * #slot configuration.preferences
     * user preferences such as scroll-to-zoom and animation behavior, see
     * PreferencesConfigSchema
     */
    preferences: PreferencesConfigSchemaFactory(),
    /**
     * #slot configuration.theme
     */
    theme: {
      type: 'frozen',
      description: 'Material UI theme overrides applied to the JBrowse UI',
      defaultValue: {},
    },
    /**
     * #slot configuration.extraThemes
     */
    extraThemes: {
      type: 'frozen',
      description: 'additional named themes the user can switch between',
      defaultValue: {},
      advanced: true,
    },
    /**
     * #slotAnnot
     * this is a collection of 'namespaced' configs e.g. configuration.YourPlugin.slot
     */
    ...pluginManager.pluginConfigurationNamespacedSchemas(),
    /**
     * #slotAnnot
     * this is a collection of 'unnamespaced' configs e.g. configuration.slot
     */
    ...pluginManager.pluginConfigurationUnnamespacedSchemas(),
  })
}
