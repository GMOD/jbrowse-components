---
id: multilinerenderer
title: MultiLineRenderer
toplevel: true
---






### MultiLineRenderer - Slots
#### slot: displayCrossHatches



```js
displayCrossHatches: {
      type: 'boolean',
      description: 'choose to draw cross hatches (sideways lines)',
      defaultValue: false,
    }
```

#### slot: summaryScoreMode



```js
summaryScoreMode: {
      type: 'stringEnum',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      defaultValue: 'avg',
    }
```


## MultiLineRenderer - Derives from




```js
baseConfiguration: baseWiggleRendererConfigSchema
```

 
