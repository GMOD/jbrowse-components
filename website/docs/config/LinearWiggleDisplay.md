---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts)

extends

- [SharedWiggleDisplay](../sharedwiggledisplay)

### LinearWiggleDisplay - Slots

#### slot: defaultRendering

```js
defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['density', 'xyplot', 'line']),
        defaultValue: 'xyplot',
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  DensityRenderer: DensityRendererConfigSchema,
  XYPlotRenderer: XYPlotRendererConfigSchema,
  LinePlotRenderer: LinePlotRendererConfigSchema,
})
```

### LinearWiggleDisplay - Derives from

```js
baseConfiguration: sharedWiggleConfigFactory()
```
