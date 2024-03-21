---
id: linearpileupdisplay
title: LinearPileupDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/LinearPileupDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/configSchema.ts)

### LinearPileupDisplay - Slots

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

#### slot: defaultRendering

```js
defaultRendering: {
        defaultValue: 'pileup',
        model: types.enumeration('Rendering', ['pileup']),
        type: 'stringEnum',
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

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  PileupRenderer: pluginManager.getRendererType('PileupRenderer').configSchema,
})
```

### LinearPileupDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
