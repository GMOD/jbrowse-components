import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HierarchicalConfigSchema
 * generally exists on the config.json or root config as configuration.hierarchical
 */
export function HierarchicalConfigSchemaFactory() {
  return ConfigurationSchema('hierarchical', {
    defaultCollapsed: ConfigurationSchema('defaultCollapsed', {
      /**
       * #slot configuration.hierarchical.defaultCollapsed.categoryNames
       */
      categoryNames: {
        defaultValue: [],
        type: 'stringArray',
      },

      /**
       * #slot configuration.hierarchical.defaultCollapsed.subCategories
       */
      subCategories: {
        defaultValue: false,
        type: 'boolean',
      },

      /**
       * #slot configuration.hierarchical.defaultCollapsed.topLevelCategories
       */
      topLevelCategories: {
        defaultValue: false,
        type: 'boolean',
      },
    }),
    sort: ConfigurationSchema('hierarchicalSort', {
      /**
       * #slot configuration.hierarchical.sort.categories
       */
      categories: {
        defaultValue: false,
        type: 'boolean',
      },

      /**
       * #slot configuration.hierarchical.sort.trackNames
       */
      trackNames: {
        defaultValue: false,
        type: 'boolean',
      },
    }),
  })
}
