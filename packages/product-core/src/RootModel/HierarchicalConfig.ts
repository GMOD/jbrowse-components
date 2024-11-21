import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HierarchicalConfigSchema
 * generally exists on the config.json or root config as configuration.hierarchical
 */
export function HierarchicalConfigSchemaFactory() {
  return ConfigurationSchema('hierarchical', {
    sort: ConfigurationSchema('hierarchicalSort', {
      /**
       * #slot configuration.hierarchical.sort.trackNames
       */
      trackNames: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.hierarchical.sort.categories
       */
      categories: {
        type: 'boolean',
        defaultValue: false,
      },
    }),
    defaultCollapsed: ConfigurationSchema('defaultCollapsed', {
      /**
       * #slot configuration.hierarchical.defaultCollapsed.categoryNames
       */
      categoryNames: {
        type: 'stringArray',
        defaultValue: [],
      },
      /**
       * #slot configuration.hierarchical.defaultCollapsed.topLevelCategories
       */
      topLevelCategories: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.hierarchical.defaultCollapsed.subCategories
       */
      subCategories: {
        type: 'boolean',
        defaultValue: false,
      },
    }),
  })
}
