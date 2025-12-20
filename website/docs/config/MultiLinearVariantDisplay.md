---
id: multilinearvariantdisplay
title: MultiLinearVariantDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/MultiLinearVariantDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/MultiLinearVariantDisplay.md)

## Docs

extends

- [SharedVariantDisplay](../sharedvariantdisplay)

### MultiLinearVariantDisplay - Slots

#### slot: defaultRendering

```js
defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['multivariant']),
        defaultValue: 'multivariant',
      }
```

#### slot: renderers

```js
renderers: ConfigurationSchema('RenderersConfiguration', {
  MultiVariantRenderer: MultiVariantRendererConfigSchema,
})
```

#### slot: height

```js
height: {
        type: 'number',
        defaultValue: 200,
      }
```

### MultiLinearVariantDisplay - Derives from

```js
baseConfiguration: sharedVariantConfigFactory()
```
