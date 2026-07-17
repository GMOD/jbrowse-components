import { ConfigurationSchema } from '@jbrowse/core/configuration'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
  HierarchicalConfigSchemaFactory,
  PreferencesConfigSchemaFactory,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ConfigurationSchemaDefinition } from '@jbrowse/core/configuration'

// The JBrowse-hosted session-sharing backend. Single source of truth for both
// the write path (this slot's default, read via getConf) and the SessionLoader
// read path (which reads the raw config snapshot before config is initialized),
// so the two can't drift onto different endpoints.
export const DEFAULT_SHARE_URL = 'https://share.jbrowse.org/api/v1/'

/**
 * #config JBrowseConfiguration
 * #category root
 * this is the entry under the `configuration` key
 * e.g.
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
     * jexl callbacks that add or reformat fields shown in the feature details
     * panel, see FormatDetails
     */
    formatDetails: FormatDetailsConfigSchemaFactory(),

    /**
     * #slot configuration.formatAbout
     * jexl callbacks that add or reformat fields shown in a track's About
     * dialog, see FormatAbout
     */
    formatAbout: FormatAboutConfigSchemaFactory(),

    /**
     * #slot configuration.shareURL
     * URL of the session-sharing backend used by the Share button, a
     * JBrowse-hosted service by default
     */
    shareURL: {
      type: 'string',
      defaultValue: DEFAULT_SHARE_URL,
      advanced: true,
    },
    /**
     * #slot configuration.disableAnalytics
     * disables collection of anonymous usage analytics
     */
    disableAnalytics: {
      type: 'boolean',
      defaultValue: false,
      advanced: true,
    },
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
     * #slot configuration.logoPath
     */
    logoPath: {
      type: 'fileLocation',
      description: 'path to a custom logo image displayed in the app header',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
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
