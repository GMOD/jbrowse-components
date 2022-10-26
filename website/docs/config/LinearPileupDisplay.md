---
id: linearpileupdisplay
title: LinearPileupDisplay
toplevel: true
---






### LinearPileupDisplay - Slots
#### slot: defaultRendering



```js
defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup']),
        defaultValue: 'pileup',
      }
```

#### slot: renderers



```js
renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer:
          pluginManager.getRendererType('PileupRenderer').configSchema,
      })
```

#### slot: maxFeatureScreenDensity



```js
maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
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


## LinearPileupDisplay - Derives from




```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```

 
