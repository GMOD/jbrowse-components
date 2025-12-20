---
id: linearpileupdisplay
title: LinearPileupDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearPileupDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearPileupDisplay.md)

## Docs

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
          pluginManager.getRendererType('PileupRenderer')!.configSchema,
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

#### slot: colorBy

```js
colorBy: {
        type: 'frozen',
        description: 'color scheme to use',
        defaultValue: {
          type: 'normal',
        },
      }
```

#### slot: filterBy

```js
filterBy: {
        type: 'frozen',
        description: 'default filters to use',
        defaultValue: defaultFilterFlags,
      }
```

### LinearPileupDisplay - Derives from

```js
baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager)
```
