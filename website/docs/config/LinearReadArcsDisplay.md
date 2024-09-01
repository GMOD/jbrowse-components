---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearReadArcsDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadArcsDisplay/configSchema.ts)

### LinearReadArcsDisplay - Slots

#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      }
```

#### slot: lineWidth

```js
lineWidth: {
        type: 'number',
        description: 'set arc line width',
        defaultValue: 1,
      }
```

#### slot: jitter

```js
jitter: {
        type: 'number',
        description:
          'jitters the x position so e.g. if many reads map to exact same x position, jittering makes it easy to see that there are many of them',
        defaultValue: 0,
      }
```

#### slot: colorScheme

```js
colorScheme: {
        type: 'stringEnum',
        model: types.enumeration('colorScheme', [
          'strand',
          'normal',
          'insertSize',
          'insertSizeAndOrientation',
          'mappingQuality',
          'tag',
        ]),
        description: 'color scheme to use',
        defaultValue: 'normal',
      }
```

### LinearReadArcsDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
