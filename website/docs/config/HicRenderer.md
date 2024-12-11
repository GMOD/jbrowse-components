---
id: hicrenderer
title: HicRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/HicRenderer/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HicRenderer.md)

## Docs

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
      defaultValue: 'jexl:interpolate(count,scale)',
      contextVariable: ['count', 'maxScore', 'baseColor', 'scale'],
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
