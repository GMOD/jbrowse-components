---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MultiLinearWiggleDisplay.md)

## Docs

extends

- [SharedWiggleDisplay](../sharedwiggledisplay)

### MultiLinearWiggleDisplay - Slots

#### slot: defaultRendering

```js
defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', [
          'multirowxy',
          'xyplot',
          'multirowdensity',
          'multiline',
          'multirowline',
        ]),
        defaultValue: 'multirowxy',
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  MultiXYPlotRenderer: MultiXYPlotRendererConfigSchema,
  MultiDensityRenderer: MultiDensityRendererConfigSchema,
  MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
  MultiLineRenderer: MultiLineRendererConfigSchema,
  MultiRowLineRenderer: MultiRowLineRendererConfigSchema,
})
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 200,
      }
```

### MultiLinearWiggleDisplay - Derives from

```js
baseConfiguration: sharedWiggleConfigFactory()
```
