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

    /*
     * #slot configuration.shareURL
     */
    shareURL: {
      type: 'string',
      defaultValue: 'https://share.jbrowse.org/api/v1/',
    },
    /**
     * #slot configuration.disableAnalytics
     */
    disableAnalytics: {
      type: 'boolean',
      defaultValue: false,
    },
    /**
     * #slot configuration.extendDefaultSessionWithUrlParams
     * when true, URL params like `&loc=` navigate within the configured
     * defaultSession (preserving its tracks and settings) instead of starting a
     * fresh session
     */
    extendDefaultSessionWithUrlParams: {
      type: 'boolean',
      defaultValue: false,
    },

    hierarchical: HierarchicalConfigSchemaFactory(),
    /**
     * #slot configuration.preferences
     */
    preferences: PreferencesConfigSchemaFactory(),
    /**
     * #slot configuration.theme
     */
    theme: {
      type: 'frozen',
      defaultValue: {},
    },
    /**
     * #slot configuration.extraThemes
     */
    extraThemes: {
      type: 'frozen',
      defaultValue: {},
    },
    /**
     * #slot configuration.logoPath
     */
    logoPath: {
      type: 'fileLocation',
      defaultValue: {
        uri: '',
        locationType: 'UriLocation',
      },
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
