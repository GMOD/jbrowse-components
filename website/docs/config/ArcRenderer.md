---
id: arcrenderer
title: ArcRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/arc/src/ArcRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/ArcRenderer/configSchema.ts)

### ArcRenderer - Slots

#### slot: color

```js
color: {
      type: 'color',
      description: 'the color of the arcs',
      defaultValue: 'darkblue',
      contextVariable: ['feature'],
    }
```

#### slot: thickness

```js
thickness: {
      type: 'number',
      description: 'the thickness of the arcs',
      defaultValue: `jexl:logThickness(feature,'score')`,
      contextVariable: ['feature'],
    }
```

#### slot: label

```js
label: {
      type: 'string',
      description: 'the label to appear at the apex of the arcs',
      defaultValue: `jexl:get(feature,'score')`,
      contextVariable: ['feature'],
    }
```

#### slot: height

```js
height: {
      type: 'number',
      description: 'the height of the arcs',
      defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
      contextVariable: ['feature'],
    }
```

#### slot: caption

```js
caption: {
      type: 'string',
      description:
        'the caption to appear when hovering over any point on the arcs',
      defaultValue: `jexl:get(feature,'name')`,
      contextVariable: ['feature'],
    }
```

#### slot: displayMode

```js
displayMode: {
      type: 'enum',
      defaultValue: 'arcs',
      model: types.enumeration('DisplayMode', ['arcs', 'semicircles']),
      description: 'render semi-circles instead of arcs',
    }
```
