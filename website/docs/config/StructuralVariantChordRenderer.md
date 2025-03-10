---
id: structuralvariantchordrenderer
title: StructuralVariantChordRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/StructuralVariantChordRenderer/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/StructuralVariantChordRenderer.md)

## Docs

### StructuralVariantChordRenderer - Slots

#### slot: strokeColor

```js
strokeColor: {
      type: 'color',
      description: 'the line color of each arc',
      defaultValue: 'rgba(255,133,0,0.32)',
      contextVariable: ['feature'],
    }
```

#### slot: strokeColorSelected

```js
strokeColorSelected: {
      type: 'color',
      description: 'the line color of an arc that has been selected',
      defaultValue: 'black',
      contextVariable: ['feature'],
    }
```

#### slot: strokeColorHover

```js
strokeColorHover: {
      type: 'color',
      description:
        'the line color of an arc that is being hovered over with the mouse',
      defaultValue: '#555',
      contextVariable: ['feature'],
    }
```
