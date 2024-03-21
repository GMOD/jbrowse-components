---
id: multilinerenderer
title: MultiLineRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/wiggle/src/MultiLineRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/MultiLineRenderer/configSchema.ts)

### MultiLineRenderer - Slots

#### slot: displayCrossHatches

```js
displayCrossHatches: {
      defaultValue: false,
      description: 'choose to draw cross hatches (sideways lines)',
      type: 'boolean',
    }
```

#### slot: summaryScoreMode

```js
summaryScoreMode: {
      defaultValue: 'avg',
      description:
        'choose whether to use max/min/average or whiskers which combines all three into the same rendering',
      model: types.enumeration('Score type', ['max', 'min', 'avg', 'whiskers']),
      type: 'stringEnum',
    }
```

### MultiLineRenderer - Derives from

```js
baseConfiguration: baseWiggleRendererConfigSchema
```
