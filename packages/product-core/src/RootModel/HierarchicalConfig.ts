import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config HierarchicalConfigSchema
 * #category root
 * Sets the hierarchical track selector's starting sort order, and which
 * categories show as folders or start collapsed. Found on the root config as
 * `configuration.hierarchical`.
 */
export function HierarchicalConfigSchemaFactory() {
  return ConfigurationSchema('hierarchical', {
    sort: ConfigurationSchema('hierarchicalSort', {
      /**
       * #slot configuration.hierarchical.sort.trackNames
       * sort the track selector's tree alphabetically inside each category
       * rather than in config order. The track table sorts by its column
       * headers instead
       */
      trackNames: {
        type: 'boolean',
        defaultValue: false,
      },
      /**
       * #slot configuration.hierarchical.sort.categories
       * sort the track selector's tree categories alphabetically rather than
       * in config order
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
    table: ConfigurationSchema('hierarchicalTable', {
      /**
       * #slot configuration.hierarchical.table.columns
       * the columns the track table shows beside the track name, most
       * important first, e.g. `['metadata.assay', 'metadata.biosample',
       * 'metadata.target']`. An entry is `category`, `kind`, `description`,
       * `adapter`, or `metadata.<key>` for a top-level metadata key (the rest
       * of the path is the key, dots included). The table shows as many
       * columns as fit its width, in this order, then fills any remaining
       * room with the fields JBrowse would pick on its own (category, kind,
       * and metadata keys that group tracks). The filters for the first three
       * columns start open. Entries that no track has are skipped. A user's
       * choice in Manage columns overrides this list
       */
      columns: {
        type: 'stringArray',
        defaultValue: [],
      },
    }),
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
