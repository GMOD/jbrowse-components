---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadCloudDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearReadCloudDisplay.md)

## Docs

### LinearReadCloudDisplay - Slots

#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      }
```

#### slot: featureHeight

```js
featureHeight: {
        type: 'number',
        defaultValue: 7,
      }
```

#### slot: colorBy

```js
colorBy: {
        type: 'frozen',
        defaultValue: { type: 'insertSizeAndOrientation' },
      }
```

#### slot: filterBy

```js
filterBy: {
        type: 'frozen',
        defaultValue: defaultFilterFlags,
      }
```

### LinearReadCloudDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
