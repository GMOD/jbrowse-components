---
id: wigglerenderer
title: WiggleRenderer
toplevel: true
---
this is the "base wiggle renderer config schema"
#### slot: color
```js

    /**
     * !slot
     */
    color: {
      type: 'color',
      description: 'the color of track, overrides posColor and negColor',
      defaultValue: '#f0f',
    }
```
#### slot: posColor
```js

    /**
     * !slot
     */
    posColor: {
      type: 'color',
      description: 'the color to use when the score is positive',
      defaultValue: 'blue',
    }
```
#### slot: negColor
```js

    /**
     * !slot
     */
    negColor: {
      type: 'color',
      description: 'the color to use when the score is negative',
      defaultValue: 'red',
    }
```
#### slot: clipColor
```js

    /**
     * !slot
     */
    clipColor: {
      type: 'color',
      description: 'the color of the clipping marker',
      defaultValue: 'red',
    }
```
#### slot: bicolorPivot
```js

    /**
     * !slot
     */
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

    /**
     * !slot
     */
    bicolorPivotValue: {
      type: 'number',
      defaultValue: 0,
      description: 'value to use for bicolor pivot',
    }
```
