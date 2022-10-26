---
id: structuralvariantchordrenderer
title: StructuralVariantChordRenderer
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

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
