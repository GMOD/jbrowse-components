---
id: linearwiggledisplay
title: LinearWiggleDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearWiggleDisplay.md)

## Docs

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
