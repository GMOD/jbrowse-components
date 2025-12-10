---
id: chordvariantdisplay
title: ChordVariantDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/ChordVariantDisplay/models/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ChordVariantDisplay.md)

## Docs

### ChordVariantDisplay - Slots

#### slot: onChordClick

```js
onChordClick: {
        type: 'boolean',
        description:
          'callback that should be run when a chord in the track is clicked',
        defaultValue: false,
        contextVariable: ['feature', 'track', 'pluginManager'],
      }
```

#### slot: renderer

```js
renderer: types.optional(pluginManager.pluggableConfigSchemaType('renderer'), {
  type: 'StructuralVariantChordRenderer',
})
```
