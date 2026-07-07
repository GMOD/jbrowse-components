---
id: hierarchicalconfigschema
title: HierarchicalConfigSchema
sidebar_label: Root -> HierarchicalConfigSchema
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Built into JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/HierarchicalConfig.ts).

## Overview

generally exists on the config.json or root config as configuration.hierarchical

| Slot                                                                                                                                | Type          | Description                                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------- |
| [configuration.hierarchical.sort.trackNames](#slot-configurationhierarchicalsorttracknames)                                         | `boolean`     |                                                         |
| [configuration.hierarchical.sort.categories](#slot-configurationhierarchicalsortcategories)                                         | `boolean`     |                                                         |
| [configuration.hierarchical.defaultFolderCategories](#slot-configurationhierarchicaldefaultfoldercategories)                        | `stringArray` | list of category names to display as folders by default |
| [configuration.hierarchical.defaultCollapsed.categoryNames](#slot-configurationhierarchicaldefaultcollapsedcategorynames)           | `stringArray` |                                                         |
| [configuration.hierarchical.defaultCollapsed.topLevelCategories](#slot-configurationhierarchicaldefaultcollapsedtoplevelcategories) | `boolean`     |                                                         |
| [configuration.hierarchical.defaultCollapsed.subCategories](#slot-configurationhierarchicaldefaultcollapsedsubcategories)           | `boolean`     |                                                         |

<details>
<summary>HierarchicalConfigSchema - Slots</summary>

#### slot: configuration.hierarchical.sort.trackNames

**Type:** `boolean` · **Default:** `false`

#### slot: configuration.hierarchical.sort.categories

**Type:** `boolean` · **Default:** `false`

#### slot: configuration.hierarchical.defaultFolderCategories

list of category names to display as folders by default

**Type:** `stringArray` · **Default:** `[]`

#### slot: configuration.hierarchical.defaultCollapsed.categoryNames

**Type:** `stringArray` · **Default:** `[]`

#### slot: configuration.hierarchical.defaultCollapsed.topLevelCategories

**Type:** `boolean` · **Default:** `false`

#### slot: configuration.hierarchical.defaultCollapsed.subCategories

**Type:** `boolean` · **Default:** `false`

</details>
