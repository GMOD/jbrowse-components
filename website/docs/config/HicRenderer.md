---
id: hicrenderer
title: HicRenderer
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### HicRenderer - Slots

#### slot: baseColor

```js
baseColor: {
      type: 'color',
      description: 'base color to be used in the hic alignment',
      defaultValue: '#f00',
    }
```

#### slot: color

```js
color: {
      type: 'color',
      description: 'the color of each feature in a hic alignment',
      defaultValue: `jexl:colorString(hsl(alpha(baseColor,min(1,count/(maxScore/20)))))`,
      contextVariable: ['count', 'maxScore', 'baseColor'],
    }
```

#### slot: maxHeight

```js
maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a hic rendering',
      defaultValue: 600,
    }
```
