import { ConfigurationSchema } from '@jbrowse/core/configuration'

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
       * #slot configuration.hierarchical.defaultCollapse.categoryNames
       */
      categoryNames: {
        type: 'stringArray',
        defaultValue: [],
      },
      /**
       * #slot configuration.hierarchical.defaultCollapse.topLevelCategories
       */
      topLevelCategories: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.hierarchical.defaultCollapse.subCategories
       */
      subCategories: {
        type: 'boolean',
        defaultValue: false,
      },
    }),
  })
}
