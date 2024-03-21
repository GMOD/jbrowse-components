---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/LinearWiggleDisplay/models/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/models/configSchema.ts)

extends

- [SharedWiggleDisplay](../sharedwiggledisplay)

### LinearWiggleDisplay - Slots

#### slot: defaultRendering

```js
defaultRendering: {
        defaultValue: 'xyplot',
        model: types.enumeration('Rendering', ['density', 'xyplot', 'line']),
        type: 'stringEnum',
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  DensityRenderer: DensityRendererConfigSchema,
  LinePlotRenderer: LinePlotRendererConfigSchema,
  XYPlotRenderer: XYPlotRendererConfigSchema,
})
```

### LinearWiggleDisplay - Derives from

```js
baseConfiguration: sharedWiggleConfigFactory()
```
