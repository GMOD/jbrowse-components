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

#### slot: bicolorPivot

```js
bicolorPivot: {
      defaultValue: 'numeric',
      description: 'type of bicolor pivot',
      model: types.enumeration('Scale type', [
        'numeric',
        'mean',
        'z_score',
        'none',
      ]),
      type: 'stringEnum',
    }
```

#### slot: bicolorPivotValue

```js
bicolorPivotValue: {
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
      type: 'number',
    }
```

#### slot: clipColor

```js
clipColor: {
      defaultValue: 'red',
      description: 'the color of the clipping marker',
      type: 'color',
    }
```

#### slot: color

```js
color: {
      defaultValue: '#f0f',
      description: 'the color of track, overrides posColor and negColor',
      type: 'color',
    }
```

#### slot: negColor

```js
negColor: {
      defaultValue: 'red',
      description: 'the color to use when the score is negative',
      type: 'color',
    }
```

#### slot: posColor

```js
posColor: {
      defaultValue: 'blue',
      description: 'the color to use when the score is positive',
      type: 'color',
    }
```
