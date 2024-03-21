---
id: arcrenderer
title: ArcRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/arc/src/ArcRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/ArcRenderer/configSchema.ts)

### ArcRenderer - Slots

#### slot: caption

```js
caption: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'name')`,
      description:
        'the caption to appear when hovering over any point on the arcs',
      type: 'string',
    }
```

#### slot: color

```js
color: {
      contextVariable: ['feature'],
      defaultValue: 'darkblue',
      description: 'the color of the arcs',
      type: 'color',
    }
```

#### slot: displayMode

```js
displayMode: {
      defaultValue: 'arcs',
      description: 'render semi-circles instead of arcs',
      model: types.enumeration('DisplayMode', ['arcs', 'semicircles']),
      type: 'enum',
    }
```

#### slot: height

```js
height: {
      contextVariable: ['feature'],
      defaultValue: `jexl:log10(get(feature,'end')-get(feature,'start'))*50`,
      description: 'the height of the arcs',
      type: 'number',
    }
```

#### slot: label

```js
label: {
      contextVariable: ['feature'],
      defaultValue: `jexl:get(feature,'score')`,
      description: 'the label to appear at the apex of the arcs',
      type: 'string',
    }
```

#### slot: thickness

```js
thickness: {
      contextVariable: ['feature'],
      defaultValue: `jexl:logThickness(feature,'score')`,
      description: 'the thickness of the arcs',
      type: 'number',
    }
```
