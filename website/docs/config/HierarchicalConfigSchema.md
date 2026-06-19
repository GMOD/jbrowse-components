---
id: hierarchicalconfigschema
title: HierarchicalConfigSchema
sidebar_label: Root -> HierarchicalConfigSchema
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/HierarchicalConfig.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HierarchicalConfigSchema.md)

## Overview

generally exists on the config.json or root config as configuration.hierarchical

### HierarchicalConfigSchema - Slots

#### slot: configuration.hierarchical.sort.trackNames

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: configuration.hierarchical.sort.categories

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: configuration.hierarchical.defaultFolderCategories

```js
{
  type: 'stringArray',
  description: 'list of category names to display as folders by default',
  defaultValue: [],
}
```

#### slot: configuration.hierarchical.defaultCollapsed.categoryNames

```js
{
  type: 'stringArray',
  defaultValue: [],
}
```

#### slot: configuration.hierarchical.defaultCollapsed.topLevelCategories

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: configuration.hierarchical.defaultCollapsed.subCategories

```js
{
  type: 'boolean',
  defaultValue: false,
}
```
