---
id: linearreadclouddisplay
title: LinearReadCloudDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearReadCloudDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadCloudDisplay/configSchema.ts)

### LinearReadCloudDisplay - Slots

#### slot: colorScheme

```js
colorScheme: {
        defaultValue: 'normal',
        description: 'color scheme to use',
        model: types.enumeration('colorScheme', [
          'strand',
          'normal',
          'insertSize',
          'insertSizeAndOrientation',
          'mappingQuality',
          'tag',
        ]),
        type: 'stringEnum',
      }
```

#### slot: featureHeight

```js
featureHeight: {
        defaultValue: 7,
        type: 'number',
      }
```

#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
        defaultValue: 5,
        description: 'maximum features per pixel that is displayed in the view',
        type: 'number',
      }
```

### LinearReadCloudDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
