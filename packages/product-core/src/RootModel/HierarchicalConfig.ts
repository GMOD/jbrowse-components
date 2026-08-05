import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HierarchicalConfigSchema
 * #category root
 * generally exists on the config.json or root config as configuration.hierarchical
 */
export function HierarchicalConfigSchemaFactory() {
  return ConfigurationSchema('hierarchical', {
    sort: ConfigurationSchema('hierarchicalSort', {
      /**
       * #slot configuration.hierarchical.sort.trackNames
       * start the track selector with tracks sorted alphabetically inside each
       * category rather than in config order. Only the initial state — the
       * selector's own "Sort track names" toggle overrides it from then on
       */
      trackNames: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.hierarchical.sort.categories
       * start the track selector with categories sorted alphabetically rather
       * than in config order. Only the initial state — the selector's own
       * "Sort categories" toggle overrides it from then on
       */
      categories: {
        type: 'boolean',
        defaultValue: false,
      },
    }),
    /**
     * #slot configuration.hierarchical.defaultFolderCategories
     */
    defaultFolderCategories: {
      type: 'stringArray',
      description: 'list of category names to display as folders by default',
      defaultValue: [],
    },
    defaultCollapsed: ConfigurationSchema('defaultCollapsed', {
      /**
       * #slot configuration.hierarchical.defaultCollapsed.categoryNames
       * named top-level categories that start collapsed, e.g.
       * `['ENCODE', 'RNA-seq']`. Once a user expands or collapses anything, the
       * selector remembers their state instead
       */
      categoryNames: {
        type: 'stringArray',
        defaultValue: [],
      },
      /**
       * #slot configuration.hierarchical.defaultCollapsed.topLevelCategories
       * start every top-level category collapsed, so a config with many
       * categories opens as a short list rather than a wall of tracks
       */
      topLevelCategories: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.hierarchical.defaultCollapsed.subCategories
       * start every nested category collapsed while leaving the top level
       * open, for deeply categorized track sets
       */
      subCategories: {
        type: 'boolean',
        defaultValue: false,
      },
    }),
  })
}
