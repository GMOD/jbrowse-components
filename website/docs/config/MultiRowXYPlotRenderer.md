---
id: multirowxyplotrenderer
title: MultiRowXYPlotRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/MultiRowXYPlotRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiRowXYPlotRenderer/configSchema.ts)

### MultiRowXYPlotRenderer - Slots

#### slot: displayCrossHatches

```js
displayCrossHatches: {
      defaultValue: false,
      description: 'choose to draw cross hatches (sideways lines)',
      type: 'boolean',
    }
```

#### slot: filled

```js
filled: {
      defaultValue: true,
      type: 'boolean',
    }
```

#### slot: minSize

```js
minSize: {
      defaultValue: 0,
      type: 'number',
    }
```

#### slot: summaryScoreMode

```js
summaryScoreMode: {
      defaultValue: 'whiskers',
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      type: 'stringEnum',
    }
```

### MultiRowXYPlotRenderer - Derives from

```js
baseConfiguration: baseWiggleRendererConfigSchema
```
