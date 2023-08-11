---
id: formatdetails
title: FormatDetails
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/product-core/src/RootModel/FormatDetails.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatDetails.ts)

generally exists on the config.json or root config as
configuration.formatDetails

### FormatDetails - Slots

#### slot: configuration.formatDetails.feature

```js
feature: {
      type: 'frozen',
      description: 'adds extra fields to the feature details',
      defaultValue: {},
      contextVariable: ['feature'],
    }
```

#### slot: configuration.formatDetails.subfeatures

```js
subfeatures: {
      type: 'frozen',
      description: 'adds extra fields to the subfeatures of a feature',
      defaultValue: {},
      contextVariable: ['feature'],
    }
```

#### slot: configuration.formatDetails.depth

```js
depth: {
      type: 'number',
      defaultValue: 2,
      description: 'depth to iterate on subfeatures',
    }
```
