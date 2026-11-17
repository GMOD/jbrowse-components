---
id: hierarchicalconfigschema
title: HierarchicalConfigSchema
description: "Sets the hierarchical track selector's starting sort order, and which categories show as folders or start collapsed. Found on the root config as configuration.hierarchical."
sidebar_label: Root -> HierarchicalConfigSchema
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/HierarchicalConfig.ts).

Sets the hierarchical track selector's starting sort order, and which
categories show as folders or start collapsed. Found on the root config as
`configuration.hierarchical`.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationhierarchicalsorttracknames">**configuration.hierarchical.sort.trackNames**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | sort the track selector's tree alphabetically inside each category rather than in config order. The track table sorts by its column headers instead |
| <span id="slot-configurationhierarchicalsortcategories">**configuration.hierarchical.sort.categories**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | sort the track selector's tree categories alphabetically rather than in config order |
| <span id="slot-configurationhierarchicaldefaultfoldercategories">**configuration.hierarchical.defaultFolderCategories**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | list of category names to display as folders by default |
| <span id="slot-configurationhierarchicaltablecolumns">**configuration.hierarchical.table.columns**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the columns the track table shows beside the track name, most important first, e.g. `['metadata.assay', 'metadata.biosample', 'metadata.target']`. An entry is `category`, `kind`, `description`, `adapter`, or `metadata.<key>` for a top-level metadata key (the rest of the path is the key, dots included). The table shows as many columns as fit its width, in this order, then fills any remaining room with the fields JBrowse would pick on its own (category, kind, and metadata keys that group tracks). The filters for the first three columns start open. Entries that no track has are skipped. A user's choice in Manage columns overrides this list |
| <span id="slot-configurationhierarchicaldefaultcollapsedcategorynames">**configuration.hierarchical.defaultCollapsed.categoryNames**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | named top-level categories that start collapsed, e.g. `['ENCODE', 'RNA-seq']`. Once a user expands or collapses anything, the selector remembers their state instead |
| <span id="slot-configurationhierarchicaldefaultcollapsedtoplevelcategories">**configuration.hierarchical.defaultCollapsed.topLevelCategories**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | start every top-level category collapsed, so a config with many categories opens as a short list rather than a wall of tracks |
| <span id="slot-configurationhierarchicaldefaultcollapsedsubcategories">**configuration.hierarchical.defaultCollapsed.subCategories**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | start every nested category collapsed while leaving the top level open, for deeply categorized track sets |
