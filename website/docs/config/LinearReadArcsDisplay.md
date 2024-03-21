---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearReadArcsDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadArcsDisplay/configSchema.ts)

### LinearReadArcsDisplay - Slots

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

#### slot: jitter

```js
jitter: {
        defaultValue: 0,
        description:
          'jitters the x position so e.g. if many reads map to exact same x position, jittering makes it easy to see that there are many of them',
        type: 'number',
      }
```

#### slot: lineWidth

```js
lineWidth: {
        defaultValue: 1,
        description: 'set arc line width',
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

### LinearReadArcsDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
