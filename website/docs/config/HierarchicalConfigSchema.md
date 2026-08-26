---
id: hierarchicalconfigschema
title: HierarchicalConfigSchema
sidebar_label: Root -> HierarchicalConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/HierarchicalConfig.ts).

generally exists on the config.json or root config as configuration.hierarchical

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-configurationhierarchicalsorttracknames">**configuration.hierarchical.sort.trackNames**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | start the track selector with tracks sorted alphabetically inside each category rather than in config order. Only the initial state — the selector's own "Sort track names" toggle overrides it from then on |
| <span id="slot-configurationhierarchicalsortcategories">**configuration.hierarchical.sort.categories**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | start the track selector with categories sorted alphabetically rather than in config order. Only the initial state — the selector's own "Sort categories" toggle overrides it from then on |
| <span id="slot-configurationhierarchicaldefaultfoldercategories">**configuration.hierarchical.defaultFolderCategories**</span><br>`stringArray` = <code>[]</code> | list of category names to display as folders by default |
| <span id="slot-configurationhierarchicaldefaultcollapsedcategorynames">**configuration.hierarchical.defaultCollapsed.categoryNames**</span><br>`stringArray` = <code>[]</code> | named top-level categories that start collapsed, e.g. `['ENCODE', 'RNA-seq']`. Once a user expands or collapses anything, the selector remembers their state instead |
| <span id="slot-configurationhierarchicaldefaultcollapsedtoplevelcategories">**configuration.hierarchical.defaultCollapsed.topLevelCategories**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | start every top-level category collapsed, so a config with many categories opens as a short list rather than a wall of tracks |
| <span id="slot-configurationhierarchicaldefaultcollapsedsubcategories">**configuration.hierarchical.defaultCollapsed.subCategories**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | start every nested category collapsed while leaving the top level open, for deeply categorized track sets |
