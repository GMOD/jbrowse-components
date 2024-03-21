---
id: formatdetails
title: FormatDetails
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/product-core/src/RootModel/FormatDetails.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatDetails.ts)

generally exists on the tracks in the config.json or as a 'session' config as
configuration.formatDetails

### FormatDetails - Slots

#### slot: configuration.formatDetails.depth

```js
depth: {
      defaultValue: 2,
      description:
        'depth to iterate the formatDetails->subfeatures callback on subfeatures (used for example to only apply the callback to the first layer of subfeatures)',
      type: 'number',
    }
```

#### slot: configuration.formatDetails.feature

```js
feature: {
      contextVariable: ['feature'],
      defaultValue: {},
      description: 'adds extra fields to the feature details',
      type: 'frozen',
    }
```

#### slot: configuration.formatDetails.maxDepth

```js
maxDepth: {
      defaultValue: 10000,
      description: 'hide subfeatures greater than a certain depth',
      type: 'number',
    }
```

#### slot: configuration.formatDetails.subfeatures

```js
subfeatures: {
      contextVariable: ['feature'],
      defaultValue: {},
      description: 'adds extra fields to the subfeatures of a feature',
      type: 'frozen',
    }
```
