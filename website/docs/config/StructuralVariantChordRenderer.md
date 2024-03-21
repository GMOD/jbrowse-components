---
id: structuralvariantchordrenderer
title: StructuralVariantChordRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/variants/src/StructuralVariantChordRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/StructuralVariantChordRenderer/configSchema.ts)

### StructuralVariantChordRenderer - Slots

#### slot: strokeColor

```js
strokeColor: {
      contextVariable: ['feature'],
      defaultValue: 'rgba(255,133,0,0.32)',
      description: 'the line color of each arc',
      type: 'color',
    }
```

#### slot: strokeColorHover

```js
strokeColorHover: {
      contextVariable: ['feature'],
      defaultValue: '#555',
      description:
        'the line color of an arc that is being hovered over with the mouse',
      type: 'color',
    }
```

#### slot: strokeColorSelected

```js
strokeColorSelected: {
      contextVariable: ['feature'],
      defaultValue: 'black',
      description: 'the line color of an arc that has been selected',
      type: 'color',
    }
```
