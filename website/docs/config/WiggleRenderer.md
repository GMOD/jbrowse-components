---
id: wigglerenderer
title: WiggleRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/configSchema.ts)

this is the "base wiggle renderer config schema"

### WiggleRenderer - Slots

#### slot: color

```js
color: {
      type: 'color',
      description: 'the color of track, overrides posColor and negColor',
      defaultValue: '#f0f',
    }
```

#### slot: posColor

```js
posColor: {
      type: 'color',
      description: 'the color to use when the score is positive',
      defaultValue: 'blue',
    }
```

#### slot: negColor

```js
negColor: {
      type: 'color',
      description: 'the color to use when the score is negative',
      defaultValue: 'red',
    }
```

#### slot: clipColor

```js
clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    }
```

#### slot: bicolorPivot

```js
bicolorPivot: {
      type: 'stringEnum',
      model: types.enumeration('Scale type', [
        'numeric',
        'mean',
        'z_score',
        'none',
      ]),
      description: 'type of bicolor pivot',
      defaultValue: 'numeric',
    }
```

#### slot: bicolorPivotValue

```js
bicolorPivotValue: {
      type: 'number',
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
    }
```
