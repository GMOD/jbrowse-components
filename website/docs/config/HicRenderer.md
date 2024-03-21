---
id: hicrenderer
title: HicRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/hic/src/HicRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicRenderer/configSchema.ts)

### HicRenderer - Slots

#### slot: baseColor

```js
baseColor: {
      defaultValue: '#f00',
      description: 'base color to be used in the hic alignment',
      type: 'color',
    }
```

#### slot: color

```js
color: {
      contextVariable: ['count', 'maxScore', 'baseColor'],
      defaultValue: `jexl:colorString(hsl(alpha(baseColor,min(1,count/(maxScore/20)))))`,
      description: 'the color of each feature in a hic alignment',
      type: 'color',
    }
```

#### slot: maxHeight

```js
maxHeight: {
      defaultValue: 600,
      description: 'the maximum height to be used in a hic rendering',
      type: 'integer',
    }
```
