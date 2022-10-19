---
id: multirowxyplotrenderer
title: MultiRowXYPlotRenderer
toplevel: true
---

#### slot: filled
```js

    /**
     * !slot
     */
    filled: {
      type: 'boolean',
      defaultValue: true,
    }
```
#### slot: displayCrossHatches
```js

    /**
     * !slot
     */
    displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```
#### slot: summaryScoreMode
```js

    /**
     * !slot
     */
    summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'whiskers',
    }
```
#### slot: minSize
```js

    /**
     * !slot
     */
    minSize: {
      type: 'number',
      defaultValue: 0,
    }
```
#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: baseWiggleRendererConfigSchema
```
