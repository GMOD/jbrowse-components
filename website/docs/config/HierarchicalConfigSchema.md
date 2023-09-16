---
id: hierarchicalconfigschema
title: HierarchicalConfigSchema
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/product-core/src/RootModel/HierarchicalConfig.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/HierarchicalConfig.ts)

generally exists on the config.json or root config as configuration.hierarchical

### HierarchicalConfigSchema - Slots

#### slot: configuration.hierarchical.sort.trackNames

```js
trackNames: {
        type: 'boolean',
        defaultValue: false,
      }
```

#### slot: configuration.hierarchical.sort.categories

```js
categories: {
        type: 'boolean',
        defaultValue: false,
      }
```

#### slot: configuration.hierarchical.defaultCollapsed.categoryNames

```js
categoryNames: {
        type: 'stringArray',
        defaultValue: [],
      }
```

#### slot: configuration.hierarchical.defaultCollapsed.topLevelCategories

```js
topLevelCategories: {
        type: 'boolean',
        defaultValue: false,
      }
```

#### slot: configuration.hierarchical.defaultCollapsed.subCategories

```js
subCategories: {
        type: 'boolean',
        defaultValue: false,
      }
```
