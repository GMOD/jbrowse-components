---
id: linearreadarcsdisplay
title: LinearReadArcsDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearReadArcsDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearReadArcsDisplay.md)

## Docs

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

### LinearReadArcsDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
