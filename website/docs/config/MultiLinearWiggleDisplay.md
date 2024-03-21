---
id: multilinearwiggledisplay
title: MultiLinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/MultiLinearWiggleDisplay/models/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLinearWiggleDisplay/models/configSchema.ts)

extends

- [SharedWiggleDisplay](../sharedwiggledisplay)

### MultiLinearWiggleDisplay - Slots

#### slot: defaultRendering

```js
defaultRendering: {
        defaultValue: 'multirowxy',
        model: types.enumeration('Rendering', [
          'multirowxy',
          'xyplot',
          'multirowdensity',
          'multiline',
          'multirowline',
        ]),
        type: 'stringEnum',
      }
```

#### slot: height

```js
height: {
        defaultValue: 200,
        type: 'number',
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  MultiDensityRenderer: MultiDensityRendererConfigSchema,
  MultiLineRenderer: MultiLineRendererConfigSchema,
  MultiRowLineRenderer: MultiRowLineRendererConfigSchema,
  MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
  MultiXYPlotRenderer: MultiXYPlotRendererConfigSchema,
})
```

### MultiLinearWiggleDisplay - Derives from

```js
baseConfiguration: sharedWiggleConfigFactory()
```
