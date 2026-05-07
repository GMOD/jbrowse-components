---
id: formatdetails
title: FormatDetails
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/product-core/src/RootModel/FormatDetails.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/FormatDetails.md)

## Docs

generally exists on the tracks in the config.json or as a 'session' config as
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
      description:
        'depth to iterate the formatDetails->subfeatures callback on subfeatures (used for example to only apply the callback to the first layer of subfeatures)',
    }
```

#### slot: configuration.formatDetails.maxDepth

```js
maxDepth: {
      type: 'number',
      defaultValue: 10000,
      description: 'hide subfeatures greater than a certain depth',
    }
```
